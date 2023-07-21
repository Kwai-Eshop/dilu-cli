import path from "path";
import _ from "lodash";
import globby from "globby";
import pathIsAbsolute from "path-is-absolute";
import inquirer from "inquirer";
import through from "through2";
import chalk from "chalk";
import ejs from "ejs";

import log from "./log";

import vfs from "vinyl-fs";

export interface ITemplateConfig extends Record<string, any> {
  initModel: () => Record<string, any>;
  write: (
    data: Record<string, any>
  ) => void | Record<string, (data: Record<string, any>) => void>;
}

export type ITemplateMixinsFunc = (x: any) => ITemplateConfig;

export type ITemplateMixinsObj = { default: (x: any) => ITemplateConfig };

export type ITemplateMixins = ITemplateMixinsFunc | ITemplateMixinsObj;

function parsePath(pth: string) {
  var extname = path.extname(pth);

  return {
    dirname: path.dirname(pth),
    basename: path.basename(pth, extname),
    extname: extname,
  };
}

class TemplateModel {
  data: any;
  resolved: string;
  templateConfig: ITemplateConfig;
  constructor(resolved: string, templateMixins?: ITemplateMixins) {
    this.resolved = resolved;
    let templateReturn;

    if (!templateMixins || !_.isFunction(templateMixins)) {
      templateReturn = require(this.resolved);
      if (_.isPlainObject(templateReturn) && templateReturn.default) {
        this.templateConfig = templateReturn.default(log);
      } else if (_.isFunction(templateReturn)) {
        this.templateConfig = templateReturn(log);
      } else {
        throw new Error("脚手架模板返回值不正确");
      }
    } else {
      this.templateConfig = templateMixins(log);
    }
  }
  async getModel() {
    if (this.data) {
      return this.data;
    } else {
      const { initModel } = this.templateConfig;
      if (_.isFunction(initModel)) {
        const ret = initModel.call(this);
        if (ret instanceof Promise) {
          return ret.then((data) => {
            this.data = data;
            return data;
          });
        } else {
          this.data = ret;
          return ret;
        }
      } else {
        this.data = {};
      }
    }
  }
}

class Template extends TemplateModel {
  private _sourceRoot: string;
  private _destRoot: string;
  private excludePath: string[];
  constructor(resolved: string, templateMixins?: ITemplateMixins) {
    super(resolved, templateMixins);
    this.excludePath = [];
    this.sourceRoot(path.join(path.dirname(this.resolved), "../template"));
    this.destRoot(process.cwd());
  }
  sourceRoot(rootPath?: string) {
    if (_.isString(rootPath)) {
      this._sourceRoot = path.resolve(rootPath);
    }

    return this._sourceRoot;
  }
  destRoot(rootPath?: string) {
    if (_.isString(rootPath)) {
      this._destRoot = path.resolve(rootPath);
    }

    return this._destRoot;
  }
  exclude(glob) {
    var cwd = this.sourceRoot();
    this.excludePath = globby.sync(glob || [], {
      cwd: cwd,
    });
  }
  tmplPath(...args) {
    var filepath = path.join.apply(path, args);

    if (!pathIsAbsolute(filepath)) {
      filepath = path.join(this.sourceRoot(), filepath);
    }

    return filepath;
  }
  async run(palyload?: Record<string, any>) {
    var opts = this.templateConfig;

    let data = await this.getModel();
    data = {
      ...palyload,
      ...data,
    };
    if (_.isFunction(opts.write)) {
      return await opts.write.call(this, data);
    } else if (_.isPlainObject(opts.write) && Object.keys(opts.write).length) {
      const promises = [];
      Object.keys(opts.write).forEach(async (key) => {
        if (_.isFunction(opts.write[key])) {
          const writeRet = opts.write[key].call(this, data);
          if (writeRet instanceof Promise) {
            promises.push(writeRet);
          } else {
            promises.push(Promise.resolve(writeRet));
          }
          return await Promise.all(promises);
        }
      });
    } else {
      return await this._write("**/*", null, data);
    }
  }
  private _write(glob, dest, vars, isRename: boolean = false) {
    var self = this,
      opts;

    dest = dest || this.destRoot();

    vars = vars || {};

    opts = {
      cwd: self.sourceRoot(),
      cwdbase: true,
      dot: true,
    };
    return new Promise((resolve, reject) => {
      var stream = vfs
        .src(glob, opts)
        .pipe(
          (function (vars) {
            return through.obj(function (file, enc, cb) {
              if (!file.stat.isFile()) {
                return cb();
              }

              if (self.excludePath.indexOf(file.relative) == -1) {
                var contents = ejs.render(file.contents.toString(), vars);
                file.contents = Buffer.from(contents);
              }

              if (isRename) {
                var pPth = parsePath(dest);

                file.path = path.join(
                  parsePath(file.path).dirname,
                  pPth.basename + pPth.extname
                );
                log.success(
                  chalk.green(
                    `   create ${path.relative(process.cwd(), dest)}\r`
                  )
                );
              } else {
                log.success(
                  chalk.green(
                    `   create ${path.join(
                      path.relative(process.cwd(), self.destRoot()),
                      file.relative
                    )}\r`
                  )
                );
              }
              this.push(file);

              cb();
            });
          })(vars)
        )
        .pipe(vfs.dest(isRename ? path.dirname(dest) : dest));

      stream
        .on("finish", function () {
          resolve(void 0);
        })
        .on("error", function () {
          reject();
        });
    });
  }
  destPath(...args) {
    var filepath = path.join.apply(path, args);

    if (!pathIsAbsolute(filepath)) {
      filepath = path.join(this.destRoot(), filepath);
    }

    return filepath;
  }
  /**
   *
   * @param src 需要拷贝的模板路径，相对路径的话，会基于SourceRoot来寻址
   * @param to 可选，基于DestRoot
   */
  async copyTpl(src: string, to?: string) {
    if (!pathIsAbsolute(src)) {
      src = this.tmplPath(src);
    }
    if (to && !pathIsAbsolute(to)) {
      to = this.destPath(to);
    } else if (!to) {
      to = this.destRoot();
    }

    const data = await this.getModel();
    this._write(src, to, data, true);
  }
}

export default Template;
