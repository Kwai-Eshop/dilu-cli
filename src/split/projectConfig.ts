import path from "path";
import fs from "fs-extra";

import type { ISplit, INpmPackage } from ".";

export interface ISplitConfig {
  /** 拆分目录入口 */
  enter?: string | string[];
  /** 输出目录地址 */
  outputDir?: string;
  /** 迁移出的工程名称 */
  projectName?: string;
  /** 别名配置 */
  alias?: Record<string, any>;
  /** 自动扩展后缀名 */
  fileExtensions?: string[];
}
interface IPackageJson extends INpmPackage {}
interface IProjectConfig extends ISplit {}
class ProjectConfig {
  /** 工作目录 */
  workDirPath: string = process.cwd();
  /** 目标工程中配置文件路径 */
  paths: Record<string, string> = {
    /** package.json文件路径 */
    packageJsonPath: path.join(this.workDirPath, "./package.json"),
  };
  /** 拆分配置 */
  splitConfig: ISplitConfig = {};
  /** package.json文件内容 */
  packageJson: IPackageJson;
  /** 存放别名配置的临时webpack配置文件 */
  tempWebpackConfigFilePath: string;
  /** 依赖的npm包列表 */
  npmPackageList: Record<string, string>;

  constructor(options: IProjectConfig) {
    this.readSplitConfig(options)
      .readPackageJson()
      .createTempWebpackConfig();
  }

  /**
   * 读取package.json
   */
  readPackageJson() {
    const packageJson = fs.readJsonSync(this.paths.packageJsonPath);

    this.packageJson = packageJson;
    this.npmPackageList = {
      ...packageJson?.devDependencies,
      ...packageJson?.dependencies,
    };

    return this;
  }

  /**
   * 读取拆分配置
   */
  readSplitConfig(options: IProjectConfig) {
    let configFile: ISplitConfig;

    // 读取配置文件
    try {
      configFile = fs.readJsonSync(
        `${this.workDirPath}/dilu-cli.config.json`
      ).split;
    } catch {}

    /** 新工程名称 */
    const projectName = (() => {
      if (options.projectName) {
        return options.projectName;
      }

      return (
        configFile?.projectName ?? `dilu-cli_split_${new Date().valueOf()}`
      );
    })();
    // 入口文件
    this.splitConfig.enter = (() => {
      const enter = options.enter ?? configFile?.enter;

      if (!enter) throw new Error("入口参数异常");

      if (Array.isArray(enter)) {
        return enter.map((item) => path.join(this.workDirPath, item));
      }

      return enter;
    })();
    // 新工程输出目录
    this.splitConfig.outputDir = (() => {
      if (options.outputDir) {
        return path.join(options.outputDir, projectName);
      }

      return path.join(configFile?.outputDir ?? "./", projectName);
    })();
    this.splitConfig.projectName = projectName;
    this.splitConfig.alias = configFile?.alias ?? {
      "@": "./src",
    };
    this.splitConfig.fileExtensions = configFile?.fileExtensions ?? [
      "js",
      "jsx",
      "ts",
      "tsx",
      "vue",
      "json",
    ];

    return this;
  }

  /**
   * 创建临时webpack配置文件
   */
  createTempWebpackConfig() {
    const tempWebpackConfigFilePath = `${this.workDirPath}/node_modules/.temp/dilu-split-webpack.config.js`;

    fs.ensureFileSync(tempWebpackConfigFilePath);

    // 因为madge包只能传入webpack配置文件位置，内部读取，故主动在缓存目录写入一个包含别名的webpack配置文件
    fs.writeFileSync(
      tempWebpackConfigFilePath,
      `module.exports = ${JSON.stringify(
        {
          resolve: {
            extensions: this.splitConfig.fileExtensions?.map?.(
              (item) => `.${item}`
            ),
            alias: this.splitConfig.alias,
          },
        },
        null,
        2
      )}`
    );

    this.tempWebpackConfigFilePath = tempWebpackConfigFilePath;

    return this;
  }
}

export default ProjectConfig;
