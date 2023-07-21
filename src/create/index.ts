import inquirer from "inquirer";
import _ from "lodash";
import { PluginManager } from "@/core/plugin";
import { TemplateBase } from "@/core/template";
import path from "path";
import { shellCommand } from "@/core/utils";
import shell from "shelljs";
import chalk from "chalk";
import log from "@/core/log";
import { createTemplateInstance } from "@/core/utils";
import { checkAndDownPkg } from "@/core/remote";

export enum AppType {
  Master = "master",
  Slave = "micro",
}

export type ScaffoldType = AppType | string;

export interface IScaffoldInitParam extends Record<string, any> {
  type?: ScaffoldType;
  projectName?: string;
  useJia?: boolean;
}

export enum Prefixs {
  master = "@ks-dilu/cli-template-master",
  salve = "@ks-dilu/cli-template-micro",
}

const BACK = "ksdiluback";

const masterPluginManager = new PluginManager({
  prefix: Prefixs.master,
});
const salvePluginManager = new PluginManager({
  prefix: Prefixs.salve,
});

const getProjectName = async (
  projectName?: string,
  useJia: boolean = false
) => {
  const answer = await inquirer.prompt(
    [
      {
        name: "projectName",
        type: "input",
        message: "请输入项目名称(projectName)",
        validate: function (input) {
          const finalInput = _.trim(input);
          if (finalInput) {
            return true;
          }
          return "必填项";
        },
      },
    ],
    {
      projectName,
    }
  );

  return answer.projectName;
};

const getProjectDescription = async () => {
  const answer = await inquirer.prompt([
    {
      name: "description",
      type: "input",
      message: "请输入项目描述(description)",
    },
  ]);

  return answer.description;
};

export const isDiluPluginPkg = (pkgName: string) => {
  return pkgName.indexOf(Prefixs.master) == 0 || pkgName.indexOf(Prefixs.salve);
};

export const assertScaffoldType = async (params: {
  scaffoldType?: ScaffoldType;
  tip?: string;
}) => {
  const answer = await inquirer.prompt(
    [
      {
        name: "type",
        type: "list",
        message: params?.tip ?? "选择类型",
        choices: [
          {
            name: "Master(主应用)",
            value: AppType.Master,
          },
          {
            name: "Salve(子应用)",
            value: AppType.Slave,
          },
        ],
      },
    ],
    {
      type: params?.scaffoldType,
    }
  );

  return answer.type;
};

const selectScaffold: (
  scaffoldType: ScaffoldType
) => Promise<TemplateBase> = async (scaffoldType) => {
  let scaffolds = [];
  let isMaster = scaffoldType === AppType.Master;

  if (isMaster) {
    scaffolds = masterPluginManager.getInstalled();
  } else {
    scaffolds = salvePluginManager.getInstalled();
  }

  const choices: any = scaffolds.map((it) => {
    return {
      name: `${it.name}@${it.version}---${it.description}`,
      value: it.resolved,
    };
  });

  const answer = await inquirer.prompt([
    {
      name: "resolved",
      type: "list",
      message: `选择创建${isMaster ? "主" : "子"}应用的类型`,
      choices: [
        ...choices,
        {
          name: "返回上一级",
          value: BACK,
        },
      ],
    },
  ]);
  if (answer.resolved === BACK) {
    return await getScaffold();
  }

  return createTemplateInstance(answer.resolved);
};

const getScaffold: (type?: ScaffoldType) => Promise<TemplateBase> = async (
  type: ScaffoldType
) => {
  const scaffoldType: AppType = await assertScaffoldType({
    scaffoldType: type,
  });
  const selectedScaffold = selectScaffold(scaffoldType);

  return selectedScaffold;
};

export async function createScaffold(args?: IScaffoldInitParam) {
  try {
    const scaffoldInstance = await getScaffold(args?.type);
    const projectName = await getProjectName(args?.projectName);
    const description = await getProjectDescription();
    await scaffoldInstance.output(path.join(process.cwd(), projectName), {
      ...args,
      projectName,
      description,
    });
    await initScaffoldNpm(projectName);
    return projectName;
  } catch (e) {
    console.log(e);
    return;
  }
}

export async function initScaffoldNpm(projectName: string) {
  await shell.cd(`${projectName}`);
  log.info(chalk.magenta("   正在为你安装项目依赖，请稍候……"));
  await shellCommand("npm", "install", "--legacy-peer-deps");
  log.success(
    chalk.cyan(`   恭喜你！！完成创建，你可以执行 cd ${projectName} 开始你的开发之旅
  `)
  );
}

export const execTemplate = async (packageName: string) => {
  try {
    const dirs: string = await checkAndDownPkg(packageName);

    const templateInstance = createTemplateInstance(
      path.join(dirs, "app/index.js")
    );
    await templateInstance.output((vars) => {
      console.log(path.join(process.cwd(), `${vars.name}`));
      return path.join(process.cwd(), `${vars.name}`);
    });
    await shell.cd(`${templateInstance.vars.name}`);
    log.info(chalk.magenta("   正在为你安装npm，请稍候……"));
    await shellCommand("npm", "install", "--legacy-peer-deps");
    log.success(
      chalk.cyan(`   恭喜你！！完成创建，你可以执行 cd ${templateInstance.vars.name} 开始你的开发之旅
  `)
    );
  } catch (e) {
    log.error(e);
  }
};
