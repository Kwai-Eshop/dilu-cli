import Split from "@/split";

export const command: string = `split`;
export const desc =
  "老工程拆分工具，根据提供的入口自动分析依赖，提取相关文件到指定的目录";
export const builder = (yargs) => {
  return yargs
    .check((argv) => {
      if (!argv.enter) {
        throw new Error("请填写入口参数");
      }

      return true;
    })
    .options({
      enter: {
        alias: "e",
        desc: "入口路径（相对路径）",
        string: true,
      },
      projectName: {
        alias: "n",
        desc: "文件夹名称",
        string: true,
      },
      outputDir: {
        alias: "o",
        desc: "输出目录",
        string: true,
      },
    });
};
export const handler = function (argv) {
  // console.log("功能开发中，敬请期待……");

  new Split(argv);
};
