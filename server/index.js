/*
 * ABBYY® Mobile Web Capture © 2019 ABBYY Production LLC.
 * ABBYY is either a registered trademark or a trademark of ABBYY Software Ltd.
 */

var btoa = require("btoa");
var fs = require("fs");
var express = require("express");
const httpProxy = require("http-proxy");
var settings = require("./settings");

var app = express();

app.use(express.static(settings.path || "./www"));

const proxy1 = httpProxy.createProxyServer({
  secure: false
});

proxy1.on("proxyReq", function(proxyReq, req, res, options) {
  proxyReq.setHeader(
    "Authorization",
    `Basic ${btoa(`${settings.loginFC}:${settings.passwordFC}`)}`
  );
});

proxy1.on("error", function(err, req, res) {
  res.writeHead(500, {
    "Content-Type": "text/plain"
  });

  res.end("Error request");
});

app.post("/flexicloudapi", (req, res) => {
  let targetUrl =
    settings.url +
    "/FlexiCapture12/Server/MobileApp?" +
    req.originalUrl.split("?")[1];

  if (settings.tenant) {
    targetUrl += `&Tenant=${settings.tenant}`;
  }

  if (settings.projectName) {
    targetUrl = targetUrl.replace(
      /projectName=(\w*)&/,
      `projectName=${encodeURIComponent(settings.projectName)}&`
    );
  }

  const options = {
    ignorePath: true,
    target: targetUrl
  };

  proxy1.web(req, res, options);
});

const port = process.env.PORT || settings.port || 3030;

app.listen(3030, () => {
  console.log("Server running on port " + port);
  console.log("App available on http://localhost:" + port + "/flexi-capture");
});
