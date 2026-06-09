const path = require("path");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");

const reactPath = path.dirname(require.resolve("react/package.json", { paths: [__dirname] }));
const reactDomPath = path.dirname(require.resolve("react-dom/package.json", { paths: [__dirname] }));

module.exports = {
  webpack: {
    configure: (config) => {
      config.resolve.plugins = config.resolve.plugins.filter(
        (plugin) => !(plugin instanceof ModuleScopePlugin)
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        react: reactPath,
        "react-dom": reactDomPath,
        "react/jsx-runtime": path.join(reactPath, "jsx-runtime.js"),
        "react/jsx-dev-runtime": path.join(reactPath, "jsx-dev-runtime.js"),
      };

      return config;
    },
  },
};
