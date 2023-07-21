import path from "path";
import _ from "lodash";

import through from "through2";
import chalk from "chalk";
import ejs from "ejs";

import log, { ILogger } from "./log";

import vfs from "vinyl-fs";

export type ITemplateInitModel = () => Record<string, any>;
export type TemplateCopyHandler =
  | Record<string, (dest: string, data: Record<any, any>) => void>
  | ((dest: string, data: Record<any, any>) => void);
function parsePath(pth: string) {
  var extname = path.extname(pth);

  return {
    dirname: path.dirname(pth),
    basename: path.basename(pth, extname),
    extname: extname,
  };
}

export interface IGlob {
  glob: string | string[];
  options: Partial<{
    buffer: boolean;
    read: boolean;
    since: boolean;
    removeBOM: boolean;
    sourcemaps: boolean;
    resolveSymlinks: boolean;
    dot: boolean;
    cwdbase: boolean;
    cwd: string;
    silent: boolean;
    allowEmpty: boolean;
  }>;
}

export interface ITemplate {
  source: string;
  getTemplateCopyHandler?: () => TemplateCopyHandler | undefined;
  write: (
    globConfig: IGlob,
    dest: string,
    vars: Record<any, any>,
    renameCb?: (file: any, dest: string) => string
  ) => void;
}

export abstract class TemplateBase implements ITemplate {
  source: string;
  protected templateDir: string;
  protected logger: ILogger = log;
  protected vars: Record<string, any>;
  constructor(source: string) {
    this.source = source;
    this.templateDir = "";
  }
  /**
   *
   * @param 自定义dest的handler, 参数是Template中的所有变量以及扩展参数，返回值string;
   * @param extraModel 透传到模板中的扩展参数
   */
  public async output(
    destination: (vars: Record<any, any>) => string,
    extraModel?: Record<any, any>
  );
  /**
   *
   * @param dest 模板的要保存的目录
   * @param extraModel 透传到模板中的扩展参数
   */
  public async output(destination: string, extraModel?: Record<any, any>);
  async output(
    destination: string | ((vars: Record<any, any>) => string),
    extraModel?: Record<any, any>
  ) {
    const initVars = (await this.initTemplateVars()) || {};
    const vars = {
      ...initVars,
      ...extraModel,
    };
    let dest: string;
    this.vars = vars;

    if (_.isFunction(destination)) {
      dest = destination(vars);
    } else {
      dest = destination as string;
    }

    const templateCopyHandler = this.getTemplateCopyHandler();
    if (_.isFunction(templateCopyHandler)) {
      return await templateCopyHandler(dest, vars);
    } else if (_.isPlainObject(templateCopyHandler)) {
      const customWrite = ((writeObj: TemplateCopyHandler) => {
        return async (dest, data) => {
          const promises = [];
          Object.keys(writeObj).forEach(async (key: string) => {
            const writeRet: any = writeObj[key](dest, data);
            if (writeRet instanceof Promise) {
              promises.push(writeRet);
            } else {
              promises.push(Promise.resolve(writeRet));
            }
          });
          return await Promise.all(promises);
        };
      })(templateCopyHandler);

      return await customWrite(dest, vars);
    }

    const outputRet = await this.write(
      {
        glob: "**",
        options: {
          cwd: this.source,
          cwdbase: true,
          dot: true,
        },
      },
      dest,
      vars
    );

    return outputRet;
  }
  write(
    globConfig: IGlob,
    dest: string,
    vars: Record<any, any>,
    renameCb?: (file: any, dest: string) => string
  ) {
    const { glob, options } = globConfig || {};
    return new Promise((resolve, reject) => {
      const stream = vfs
        .src(glob, options)
        .pipe(
          ((vars) => {
            return through.obj(function (file, enc, cb) {
              if (!file.stat.isFile()) {
                return cb();
              }
              file.contents = Buffer.from(
                ejs.render(file.contents.toString(), vars)
              );
              if (renameCb && _.isFunction(renameCb)) {
                file.path = renameCb(file, dest);
              }
              log.success(
                chalk.green(
                  `   create ${path.join(
                    path.relative(process.cwd(), dest),
                    file.relative
                  )}\r`
                )
              );

              this.push(file);
              cb();
            });
          })(vars)
        )
        .pipe(vfs.dest(dest));

      stream.on("finish", resolve).on("error", reject);
    });
  }
  getTemplateCopyHandler(): TemplateCopyHandler | undefined {
    return;
  }

  abstract initTemplateVars(): Promise<Record<any, any>>;
}
