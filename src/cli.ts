import yargs, { boolean } from "yargs";
import { hideBin } from "yargs/helpers";
import importModules from "import-modules";
const commands = importModules("cmds", {
  fileExtensions: [".js", ".ts"],
}) as Record<string, any>;

const argvs = hideBin(process.argv);

let yargsInstance = yargs(argvs);

const commandsKey = Object.keys(commands);

yargsInstance = commandsKey.reduce((pre, current) => {
  return pre.command(commands[current]);
}, yargsInstance);

yargsInstance.version("v", require("../package.json").version).help("h").argv;

// 没有参数是默认显示帮助信息
if (argvs.length == 0) {
  yargsInstance.showHelp();
}
