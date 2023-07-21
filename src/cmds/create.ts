import { checkAndDownPkg } from "@/core/remote";
import { CommandBuilder } from "yargs";
import {
  createScaffold,
  initScaffoldNpm,
  isDiluPluginPkg,
} from "../create/index";

export const command: string = "create [templatePkgName]";
export const desc = "创建DL（的卢）主子应用";
export const builder: CommandBuilder = {};

export const handler = async function (argv) {
  try {
    if (argv.templatePkgName && isDiluPluginPkg(argv.templatePkgName)) {
      await checkAndDownPkg(argv.templatePkgName);
    }
    await checkAndDownPkg("@ks-dilu/cli-template-micro-base");
    await checkAndDownPkg("@ks-dilu/cli-template-master-base");
  } catch {}

  try {
    await createScaffold();
  } catch {}
  return void 0;
};
