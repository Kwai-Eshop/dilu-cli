import path from "path";
import fs from "fs-extra";
import ora from "ora";

import type ProjectConfig from "./projectConfig";

interface IOutputOptions {
  config: ProjectConfig;
  /** 需要迁移的依赖文件列表 */
  fileList: string[];
}
class Output {
  private config: ProjectConfig; // 配置
  private fileList: string[]; // 需要迁移的文件列表

  constructor(options: IOutputOptions) {
    this.fileList = options.fileList;

    this.config = options.config;
    this.fileList = options.fileList;
  }

  /**
   * 创建模板
   */
  async createTemplate() {
    const {
      splitConfig: { outputDir },
    } = this.config;

    fs.ensureDirSync(outputDir);

    return this;
  }

  /**
   * 复制需要迁移的文件列表
   */
  copyTransferFile() {
    const { workDirPath } = this.config;
    const { outputDir } = this.config.splitConfig;

    const progressOra = ora({
      text: "开始复制依赖文件...",
      spinner: "shark",
    }).start();

    this.fileList.forEach((item) => {
      fs.copySync(path.join(workDirPath, item), path.join(outputDir, item));
    });

    progressOra.succeed("依赖文件复制完成");

    return this;
  }
}

export default Output;
