import log from "@/core/log";

import ProjectConfig from "./projectConfig";
import Output from "./output";
import { uniq } from "./utils";
import "./extend/madge-vue";

import type { MadgeModuleDependencyGraph, MadgeInstance } from "madge";
import type TProjectConfig from "./projectConfig";

const madge = global.madge;

export interface ISplit {
  /** 文件入口 */
  enter?: string;
  /** 输出文件夹名称 */
  projectName?: string;
  /** 输出目录位置 */
  outputDir?: string;
}
export interface INpmPackage {
  /** 生产环境依赖项 */
  dependencies?: Record<string, string>;
  /** 开发环境依赖项 */
  devDependencies?: Record<string, string>;
}
class Split {
  /** 配置信息 */
  config: TProjectConfig;
  /** madge的obj方法返回数据 */
  madgeObj: MadgeModuleDependencyGraph;
  /** 需要迁移的文件列表 */
  fileList: string[];
  /** 依赖的npm包 */
  npmPackage: INpmPackage = { dependencies: {}, devDependencies: {} };
  /** 未解析到的依赖 */
  skipped: string[] = [];

  constructor(options: ISplit) {
    this.config = new ProjectConfig(options);

    this.runMadge().then(async (res) => {
      this.madgeObj = res.obj();

      await this.madgeObj2fileList()
        .getNpmPackage(res as any)
        .output();

      res
        .image(`${this.config.splitConfig.outputDir}/graph.svg`)
        .catch(() => {});

      console.log("\n迁移的文件列表:: ", this.fileList);
      console.log("\n依赖的NPM包:: ", this.npmPackage);
      if (this.skipped.length)
        console.log(
          "\n未识别依赖，可能为依赖包的依赖或别名配置未完善:: ",
          this.skipped
        );

      console.log(`\n新工程目录: ${this.config.splitConfig.outputDir}`);

      log.success("迁移完成");
    });
  }

  /** 执行madge */
  runMadge() {
    const {
      workDirPath,
      splitConfig: { enter, fileExtensions },
      tempWebpackConfigFilePath,
    } = this.config;

    return madge(enter, {
      baseDir: workDirPath,
      fileExtensions,
      includeNpm: true,
      webpackConfig: tempWebpackConfigFilePath,
    });
  }

  /** 是否是npm包 */
  isNpmPath(path: string) {
    return path.includes("node_modules/");
  }

  /** 获取npm包 */
  getNpmPackage(
    madgeRes: {
      /** 未解析到的依赖 */
      skipped: string[];
    } & MadgeInstance
  ) {
    const { skipped = [] } = madgeRes;

    const handler = (name: string): keyof INpmPackage => {
      if (
        Object.keys(this.config.packageJson.dependencies ?? {})?.includes?.(
          name
        )
      ) {
        return "dependencies";
      }

      if (
        Object.keys(this.config.packageJson.devDependencies ?? {})?.includes?.(
          name
        )
      ) {
        return "devDependencies";
      }
    };

    // 未找到的依赖项在package.json中匹配
    for (const item of skipped) {
      // 完整匹配
      let key = handler(item);

      if (key) {
        this.npmPackage[key][item] = this.config.packageJson[key][item];

        continue;
      }

      // 如果未找到进行惰性匹配，例如文件中引入npm包的具体文件antd/dist/reset.css
      if (item.includes("/")) {
        const splitArr: string[] = item.split("/");

        for (const index in splitArr) {
          const name = splitArr.slice(0, +index + 1).join("/");
          key = handler(name);

          if (key) {
            this.npmPackage[key][name] = this.config.packageJson[key][name];
            break;
          }
        }
      }

      if (!key) {
        this.skipped.push(item);

        continue;
      }
    }

    /** 过滤fileList检测到的npm包依赖项 */
    const newFileList = [];
    for (const filePath of this.fileList) {
      if (this.isNpmPath(filePath)) {
        const npmPath = filePath.split("node_modules/")[1];

        // 完整匹配
        let key = handler(npmPath);

        if (key) {
          this.npmPackage[key][npmPath] = this.config.packageJson[key][npmPath];

          continue;
        }

        // 如果未找到进行惰性匹配，例如文件中引入npm包的具体文件antd/dist/reset.css
        if (npmPath.includes("/")) {
          const splitArr: string[] = npmPath.split("/");

          for (const index in splitArr) {
            const name = splitArr.slice(0, +index + 1).join("/");
            key = handler(name);

            if (key) {
              this.npmPackage[key][name] = this.config.packageJson[key][name];
              break;
            }
          }
        }

        if (!key) {
          this.skipped.push(npmPath);

          continue;
        }
      } else {
        newFileList.push(filePath);
      }
    }
    this.fileList = newFileList;

    return this;
  }

  /** 将madge的obj方法返回值排平为文件数组 */
  madgeObj2fileList() {
    const madgeObj = this.madgeObj;

    const fileList = Object.keys(madgeObj).reduce((arr, item) => {
      if (Array.isArray(madgeObj[item])) {
        return [...arr, item, ...madgeObj[item]];
      }

      arr.push(item);

      return arr;
    }, []);

    // 去重
    this.fileList = uniq(fileList);

    return this;
  }

  /** 输出 */
  async output() {
    const { config, fileList, npmPackage } = this;

    const output = new Output({
      config,
      fileList,
    });

    (await output.createTemplate()).copyTransferFile();

    return this;
  }
}

export default Split;
