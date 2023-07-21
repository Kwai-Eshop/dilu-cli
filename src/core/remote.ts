import download from "download";
import spawn from "cross-spawn";
import shell from "shelljs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { downloadDir, shellCommand } from "./utils";
import semver from "semver";
import log from "./log";

export const fetchPkgJsonByPkgName: (
  x: string
) => Promise<Record<string, any>> = (packageName: string) => {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", [
      "view",
      packageName,
      "version",
      "dist",
      "--json",
    ]);

    child.stdout.on("data", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (e) {
        reject(e);
      }
    });
    child.stderr.on("data", (data) => {
      reject(data.toString());
    });
  });
};

export const downloadPkg = async (packageName: string) => {
  const progressOra = ora({
    text: "开始下载-已下载(0KB)",
    spinner: "shark",
  }).start();

  const copyOra = ora({
    text: "正在解压\r\n",
    spinner: "shark",
  });
  try {
    const {
      dist: { tarball },
    } = await fetchPkgJsonByPkgName(packageName);

    const dir = path.join(downloadDir, packageName);

    await shell.rm("-rf", `${dir}`);

    await download(tarball, dir, {
      extract: true,
    }).on("downloadProgress", async (progress) => {
      const size = chalk.magenta(
        Math.floor(progress.transferred / 1024) + "KB"
      );
      if (progress.percent == 1) {
        progressOra.succeed(`${packageName} 下载完成-已下载(${size})\r\n`);
        copyOra.start();
      } else {
        progressOra.text = `${packageName} 下载中-已下载(${size})\r\n`;
      }
    });

    await shell.mv("-fn", `${dir}/package/*`, dir);
    copyOra.succeed(`完成解压\r\n`);
    return dir;
  } catch (e) {
    progressOra.stop();
    copyOra.stop();

    throw e;
  }
};

export const checkAndDownPkg = async (packageName: string) => {
  const pwd = process.cwd();
  if (packageName) {
    let tempDir = path.join(downloadDir, packageName);
    let needDownload = false;
    try {
      const pkg = require(path.join(tempDir, "package.json"));

      const { version } = await fetchPkgJsonByPkgName(packageName);

      log.info(chalk.magenta(`当前${packageName}模板版本：${pkg.version}\r\n`));

      if (semver.lt(pkg.version, version)) {
        log.info(chalk.magenta(`${packageName} 最新版本：${version}\r\n`));
        needDownload = true;
      } else {
        log.info(chalk.magenta(`${packageName} 已是最新版本\r\n`));
      }
    } catch (e) {
      needDownload = true;
    }
    if (needDownload) {
      log.info(chalk.magenta(`我们将自动更新到最新版本，请耐心等候\r\n`));
      await downloadPkg(packageName);
      log.info("开始安装模板的依赖\r\n");
      await shell.cd(`${tempDir}`);
      await shellCommand("npm", "install");
      await shell.cd(`${pwd}`);

      log.success("已更新到最新版本\r\n");
      log.info(chalk.cyan("==============================\r\n"));
    }

    return tempDir;
  }
  return "";
};
