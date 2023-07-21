"use strict";
import path from "path";
import fs from "fs";
import globby from "globby";
import os from "os";
import Store, { StoreMeta } from "./store";
import _ from "lodash";
import log from "./log";
import { getNamespaceByFilePath, getNpmPaths, findPluginsIn } from "./utils";

const home = os.homedir();
// dilu-master-main
// dilu-slave-micro
const DefaultPrefix = "plugin-";

function untildify(str: string) {
  if (typeof str != "string") {
    throw new Error(`Expected a string, got ${typeof str}`);
  }
  return home ? str.replace(/^~($|\/|\\)/, `${home}$1`) : str;
}

export interface PluginOpts {
  prefix?: string;
}
export interface AliasItem {
  match: RegExp;
}
export interface PluginConstructorParam {
  prefix: string;
  lookups?: string[];
}
export interface IPluginManager {
  getInstalled: () => Array<Record<string, StoreMeta>>;
  lookup: () => void;
  getPlugin: (namespace: string, force: boolean) => string | Function;
}

export class PluginManager {
  private prefix: string;
  private entry: string = "app";
  private lookups: Array<string>;
  private store: Store;
  constructor(opts: PluginConstructorParam) {
    this.prefix = opts?.prefix || DefaultPrefix;
    this.lookups = ["."].concat(opts?.lookups || []);
    this.store = new Store();
  }
  getInstalled() {
    var sources = [];

    this.lookup();

    const pluginMeta = this.store.getPluginsMeta();
    Object.keys(pluginMeta).forEach((v) => {
      var strs = v.split(":"),
        key = strs[1],
        source = strs[0];
      if (sources.indexOf(source) == -1 && key == this.entry) {
        sources.push({
          ...pluginMeta[v],
        });
      }
    });

    return sources;
  }
  lookup() {
    let pluginModules = findPluginsIn(getNpmPaths(), this.prefix);
    let patterns = [];
    this.lookups.forEach((lookup) => {
      pluginModules.forEach((modulePath) => {
        patterns.push(path.join(modulePath, lookup));
      });
    });

    patterns.forEach((pattern) => {
      globby
        .sync("*/index.[tj]s", {
          cwd: pattern,
        })
        .forEach((filename) => {
          this.tryRegistering(pattern, filename);
        }, this);
    }, this);
  }
  private tryRegistering(pattern: string, filename: string): void {
    let namespace,
      pluginReference = path.join(pattern, filename),
      realPath = fs.realpathSync(pluginReference);

    try {
      if (realPath != pluginReference) {
        namespace = getNamespaceByFilePath(
          pluginReference,
          this.prefix,
          this.lookups
        );
      }
      const pk = require(path.join(pattern, "package.json"));
      this.register(realPath, namespace, {
        description: pk.description,
        name: pk.name,
        version: pk.version,
      });
    } catch (e) {
      this.error(
        new Error(`Unable to register ${pluginReference} (Error: ${e.message})`)
      );
    }
  }
  private register(
    name: string,
    namespace: string,
    playload: Record<string, any>
  ) {
    if (!_.isString(name)) {
      return this.error(
        new Error("You must provide a plugin name to register.")
      );
    }

    var modulePath = this.resolveModulePath(name);
    namespace =
      namespace ||
      getNamespaceByFilePath(modulePath, this.prefix, this.lookups);

    if (!namespace) {
      this.error(new Error("Unable to determine namespace."));
    } else {
      this.store.add(namespace, modulePath, playload);
    }
  }
  private resolveModulePath(moduleId: string): string {
    if (moduleId[0] === ".") {
      moduleId = path.resolve(moduleId);
    }
    if (path.extname(moduleId) === "") {
      moduleId += path.sep;
    }

    return require.resolve(untildify(moduleId));
  }
  getPlugin(namespace: string, force: boolean = false): string | Function {
    if (force || this.store.namespaces().length == 0) {
      this.lookup();
    }
    if (!namespace) {
      return;
    }
    var parts: string[] = namespace.split(":");
    var maybePath: string = _.last(parts);

    if (parts.length > 1 && /[\/\\]/.test(maybePath)) {
      parts.pop();

      if (maybePath.indexOf("\\") >= 0 && _.last(parts).length === 1) {
        parts.pop();
      }

      namespace = parts.join(":");
    } else {
    }

    return this.store.get(namespace);
  }

  private error(err: Error) {
    log.error(err.message);
  }
}
