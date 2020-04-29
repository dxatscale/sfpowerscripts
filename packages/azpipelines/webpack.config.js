const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");

// Webpack entry points. Mapping from resulting bundle name to the source file entry.
const entries = {};

// Loop through subfolders in the "UI" folder and add an entry for each one
const hubDir = path.join(__dirname, "UI");
fs.readdirSync(hubDir).filter(dir => {
  if (fs.statSync(path.join(hubDir, dir)).isDirectory()) {
    entries[dir] =
      "./" + path.relative(process.cwd(), path.join(hubDir, dir, dir));
    console.log(entries[dir]);
  }
});

module.exports = {
  devtool: "inline-source-map",
  devServer: {
    https: true,
    port: 3000
  },
  entry: entries,
  output: {
    path: path.resolve(__dirname, "build/UI"),
    filename: "[name]/[name].js",
    publicPath: "/build/UI"
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "azure-devops-extension-sdk": path.resolve(
        "./node_modules/azure-devops-extension-sdk"
      )
    }
  },
  stats: {
    warnings: false
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          configFile: '../../tsconfig-ui.json'
        }
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader",
          "css-loader",
          "azure-devops-ui/buildScripts/css-variables-loader",
          "sass-loader"
        ]
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.woff$/,
        use: [
          {
            loader: "base64-inline-loader"
          }
        ]
      },
      {
        test: /\.html$/,
        loader: "file-loader"
      }
    ]
  },
  plugins: [new CopyWebpackPlugin([{ from: "**/*.html", context: "UI" }])]
};
