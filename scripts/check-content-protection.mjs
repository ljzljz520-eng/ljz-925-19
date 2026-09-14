// 受保护内容访问控制回归检查
// 验证：真实内容只能在服务端会话+卡密校验通过后由受控接口返回，
// 直接打开内容地址、会话过期、卡密封禁/过期均无法获得内容。
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFile(path.join(root, rel), "utf8");
}

function phpSource(encoded) {
  const m = encoded.match(/\$__payload='([A-Za-z0-9+/=]+)'/);
  return m ? Buffer.from(m[1], "base64").toString("utf8") : encoded;
}

function jsSource(encoded) {
  let current = encoded;
  while (current.includes("/* protected-build:js */")) {
    const m = current.match(/const \$__payload="([A-Za-z0-9+/=]+)"/);
    if (!m) break;
    current = Buffer.from(m[1], "base64").toString("utf8");
  }
  return current;
}

const [router, content, shell, lib, config, homeJs, gateJs] = await Promise.all([
  read("php-frontend/public/index.php").then(phpSource),
  read("php-frontend/includes/content.php").then(phpSource),
  read("php-frontend/includes/home.php").then(phpSource),
  read("php-frontend/includes/lib.php").then(phpSource),
  read("php-frontend/includes/config.php").then(phpSource),
  read("php-frontend/assets/js/home.js").then(jsSource),
  read("php-frontend/assets/js/gate.js").then(jsSource),
]);

const checks = [
  ["存在受控内容接口 GET /home/content", router.includes("'/home/content'")],
  ["内容接口输出前调用 session_guard()", /\/home\/content[\s\S]{0,400}session_guard\(\)/.test(router)],
  ["守卫失败返回 401 而不是内容", /session_guard\(\)[\s\S]{0,220}http_response_code\(401\)/.test(router)],
  ["真实内容片段带直接访问拒绝标记", content.includes("CONTENT_GUARDED") && content.includes("http_response_code(403)")],
  ["仅在 define(CONTENT_GUARDED) 后包含内容文件", /define\('CONTENT_GUARDED'[\s\S]{0,160}content\.php/.test(router)],
  ["/home 薄壳不含真实标题", !shell.includes("验证成功")],
  ["/home 薄壳不含真实正文", !shell.includes("欢迎访问专属内容")],
  [
    "public 目录下没有任何文件明文包含真实内容",
    execSync("grep -rl '欢迎访问专属内容' php-frontend/public || true", { encoding: "utf8" }).trim() === "",
  ],
  ["守卫检查服务端会话中的 token", lib.includes("$_SESSION['access_token']")],
  ["守卫复用 TokenManager 校验 token/卡密状态/过期", lib.includes("TokenManager::validateToken") && lib.includes("'key_status'") && lib.includes("key_expire_at")],
  ["独立部署下回退为后端 /auth/ping 校验", lib.includes("'/auth/ping'")],
  ["校验失败立即销毁服务端会话", /code'\]\s*!==\s*0[\s\S]{0,300}unset\(\$_SESSION/.test(lib)],
  ["home.js 从受控接口加载内容", homeJs.includes("/home/content")],
  ["home.js 收到 401/403 清除凭证并回 /gate", homeJs.includes("response.status === 401") && homeJs.includes("'/gate'")],
  ["gate.js 验卡密后建立服务端会话", gateJs.includes("/auth/session")],
  ["登出走受控 /auth/logout", homeJs.includes("/auth/logout")],
  ["logout 吊销后端 token 并销毁会话", router.includes("TokenManager::revokeToken") && router.includes("session_destroy()")],
  ["会话 Cookie 为 HttpOnly", config.includes("session.cookie_httponly")],
  ["遗留调试端点 test-session.php 已删除", !(await fs.access(path.join(root, "php-frontend/public/test-session.php")).then(() => true).catch(() => false))],
  ["遗留调试端点 set-session.php 已删除", !(await fs.access(path.join(root, "php-frontend/public/set-session.php")).then(() => true).catch(() => false))],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} 项受保护内容访问控制检查未通过。`);
  process.exit(1);
}
console.log(`\n全部 ${checks.length} 项检查通过：受保护内容只能在服务端校验后返回。`);
