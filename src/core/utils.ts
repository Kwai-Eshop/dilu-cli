import path from "path";
import _ from "lodash";
import globby from "globby";
import spawn from "cross-spawn";

export const win32 = process.platform == "win32";

export function escapeStringRegexp(string) {
  if (typeof string !== "string") {
    throw new TypeError("Expected a string");
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

export const getNpmPaths = () => {
  let paths = [];

  if (process.env.NVM_PATH) {
    paths.push(path.join(path.dirname(process.env.NVM_PATH), "node_modules"));
  }

  if (process.env.NODE_PATH) {
    paths = _.compact(process.env.NODE_PATH.split(path.delimiter)).concat(
      paths
    );
  }

  if (process.env["_"]) {
    paths = _.compact(
      path
        .join(process.env["_"], "../../lib/node_modules")
        .split(path.delimiter)
    ).concat(paths);
  }

  paths.push(path.join(__dirname, "../../../.."));
  paths.push(path.join(__dirname, "../.."));

  if (process.argv[1]) {
    paths.push(path.join(path.dirname(process.argv[1]), "../.."));
  }

  if (win32) {
    paths.push(path.join(process.env.APPDATA, "npm/node_modules"));
  } else {
    paths.push("/usr/lib/node_modules");
  }
  process
    .cwd()
    .split(path.sep)
    .forEach(function (part, i, parts) {
      var lookup = path.join.apply(
        path,
        parts.slice(0, i + 1).concat(["node_modules"])
      );

      if (!win32) {
        lookup = "/" + lookup;
      }

      paths.push(lookup);
    });

  return paths.reverse();
};

export const getNamespaceByFilePath = (
  filepath: string,
  prefix: string,
  lookups: Array<string> = []
) => {
  if (!filepath) {
    throw new Error("Missing namespace");
  }

  // cleanup extension and normalize path for differents OS
  var ns = path.normalize(
    filepath.replace(
      new RegExp(escapeStringRegexp(path.extname(filepath)) + "$"),
      ""
    )
  );

  // Sort lookups by length so biggest are removed first
  var _lookups = _(lookups.concat([".."]))
    .map(path.normalize)
    .sortBy("length")
    .value()
    .reverse();

  // if `ns` contains a lookup dir in its path, remove it.
  ns = _lookups.reduce(function (ns, lookup: string) {
    // only match full directory (begin with leading slash or start of input, end with trailing slash)
    const _lookup = new RegExp(
      "(?:\\\\|/|^)" + escapeStringRegexp(lookup) + "(?=\\\\|/)",
      "g"
    );
    return ns.replace(_lookup, "");
  }, ns);

  var folders = ns.split(path.sep);
  // var scope = _.findLast(folders, function (folder) {
  //   return folder.indexOf("@") === 0;
  // });
  var prefixReg = new RegExp(`(.*${prefix}-)`);

  // cleanup `ns` from unwanted parts and then normalize slashes to `:`
  ns = ns
    .replace(prefixReg, "") // remove before `generator-`
    .replace(/[\/\\](index|main)$/, "") // remove `/index` or `/main`
    .replace(/^[\/\\]+/, "") // remove leading `/`
    .replace(/[\/\\]+/g, ":"); // replace slashes by `:`

  // if (scope) {
  //   ns = scope + "/" + ns;
  // }
  return ns;
};

export const findPluginsIn = (searchPaths: Array<string>, prefix: string) => {
  let modules = [];
  searchPaths.forEach((root) => {
    if (!root) {
      return;
    }

    modules = globby
      .sync([`${prefix}-*`, `@ks-dilu/cli-template-${prefix}-*`], {
        cwd: root,
      })
      .map((match) => {
        return path.join(root, match);
      })
      .concat(modules);
  });

  return modules;
};

export const shellCommand = (...args: string[]) => {
  const [command, ...params] = args || [];
  return new Promise((resolve) => {
    spawn(command, [...params], {
      stdio: "inherit",
    })
      .on("error", (err) => {
        resolve(false);
      })
      .on("close", function () {
        resolve(true);
      });
  });
};

export const createTemplateInstance = (resolved) => {
  const { default: TemplateObj, Template: TCtr } = require(resolved);

  const TemplateCtr = TemplateObj || TCtr;

  return new TemplateCtr(path.join(path.dirname(resolved), "../template"));
};
export const downloadDir = getNpmPaths().pop();
