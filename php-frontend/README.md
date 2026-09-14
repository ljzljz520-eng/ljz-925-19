# PHP Frontend - 卡密访问控制系统

这是当前使用中的 PHP 前端实现，包含卡密验证、主页展示与认证状态管理。

## 项目结构

```
php-frontend/
├── public/              # Web根目录
│   ├── index.php       # 主路由文件
│   ├── api.php         # API代理文件
│   └── .htaccess       # Apache URL重写规则
├── includes/           # PHP页面模板（位于Web根目录之外，不能通过URL直接访问）
│   ├── config.php      # 配置 + 会话Cookie参数
│   ├── lib.php         # 服务端会话守卫/后端调用
│   ├── content.php     # ★ 真正的受保护内容片段（仅守卫通过后可包含）
│   ├── gate.php        # 卡密验证页面
│   └── home.php        # 主页面（薄壳，不含任何受保护内容）
└── assets/             # 静态资源
    ├── css/
    │   └── styles.css  # 样式文件（Tailwind风格）
    └── js/
        ├── utils.js    # 工具函数
        ├── gate.js     # 卡密验证页面逻辑
        └── home.js     # 主页面逻辑
```

## 功能特性

### ✅ 已实现的功能

1. **卡密验证页面 (/gate)**
   - 12位卡密输入
   - 自动转大写
   - 前端表单验证
   - 加载状态显示
   - 错误提示
   - Toast通知

2. **主页面 (/home)**
   - 页面本身只是**不含敏感内容的薄壳**（加载占位 + 加载脚本）
   - 真正内容由受控接口 `GET /home/content` 在**服务端逐请求校验**会话与卡密状态后返回 HTML 片段
   - 未验证 / token失效 / 卡密被封禁或过期：接口返回 401，前端清凭证并跳回 `/gate`
   - 直接在浏览器打开 `/home/content`（或 curl）同样必须通过校验，无法绕过
   - 30秒心跳检测（仅辅助发现失效，非安全边界）
   - 手动退出登录

3. **认证系统（服务端会话为真正的安全边界）**
   - 验卡密流程：`/api/auth/verify-key` 换 token → `POST /auth/session` 由服务端校验 token 后建立 HttpOnly Cookie 会话
   - token 同时存 localStorage，仅用于业务 API 的 `Authorization` 头与前端跳转体验
   - 服务端会话 Cookie 为 HttpOnly + SameSite=Lax，JS 无法读取
   - `includes/lib.php` 中的 `session_guard()` 每次请求都校验：会话存在 + token有效 + 卡密 active + 未过期
   - 统一容器内守卫直接在进程内查询后端 SQLite（复用 `App\TokenManager`），独立部署时回退为 HTTP 调用后端 `/api/auth/ping`
   - 退出时 `POST /auth/logout` 吊销后端 token 并销毁会话

4. **UI/UX**
   - 完整覆盖当前前端所需的界面与交互
   - Tailwind风格的CSS类
   - 响应式设计
   - 动画效果（加载动画、Toast滑入）
   - 防调试保护（禁用F12、右键等）

5. **API集成**
   - 通过API入口代理后端（同项目直连或外部API_BASE_URL）
   - 统一错误处理
   - 自动添加Authorization头

## 安装和配置

### 1. 环境要求

- PHP 7.4+
- Apache (with mod_rewrite)
- 同项目部署时自动直连后端；独立部署时需要可访问的后端API

### 2. 配置步骤

1. 将 `php-frontend` 目录放到Web服务器根目录
2. 确保Apache已启用 `mod_rewrite` 模块
3. 配置虚拟主机，将DocumentRoot指向 `php-frontend/public`
4. 如使用外部后端API，修改 `includes/config.php` 中的 `API_BASE_URL`

### 3. Apache虚拟主机配置示例

```apache
<VirtualHost *:80>
    ServerName card-code.local
    DocumentRoot "/path/to/php-frontend/public"

    <Directory "/path/to/php-frontend/public">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### 4. 使用PHP内置服务器（开发环境）

```bash
cd php-frontend/public
php -S localhost:3000
```

注意：使用PHP内置服务器时，需要手动处理路由。建议使用Apache。

## 技术实现细节

### 1. 路由系统

- 使用 `.htaccess` 实现URL重写
- `index.php` 作为前端控制器
- 支持 `/gate` 和 `/home` 路由
- 自动重定向未认证用户

### 2. 认证机制

- 使用localStorage存储token和过期时间
- API请求自动携带Authorization
- 客户端30秒心跳检测
- token过期自动跳转

### 3. API代理

- `api.php` 作为API入口
- 同项目部署时直接调用后端入口
- 外部部署时使用cURL转发到API_BASE_URL
- 自动透传Authorization头
- 统一错误处理

### 4. 样式系统

- 自定义CSS实现Tailwind风格的工具类
- 支持渐变背景、阴影、动画等
- 响应式设计
- 100%还原原UI效果

### 5. JavaScript功能

- 模块化设计（utils.js, gate.js, home.js）
- Toast通知系统
- API客户端封装
- 表单验证工具
- 加载状态管理

## 测试验证

### 功能测试清单

- [x] 访问根路径自动重定向
- [x] 卡密验证页面正常显示
- [x] 输入自动转大写
- [x] 前端验证（空值、长度）
- [x] 提交卡密并验证
- [x] 验证成功跳转到主页
- [x] 主页显示有效期
- [x] 心跳检测正常工作
- [x] 手动退出登录
- [x] Token失效自动跳转
- [x] Toast通知正常显示
- [x] 防调试功能正常
- [x] 响应式布局正常

## 注意事项

0. **安全红线（修改前必读）**
   - **不要**把任何受保护内容直接写回 `/home` 页面或任何不经守卫的静态文件；
   - 受保护内容只能放在 `includes/content.php`（Web 根之外），并由 `/home/content` 路由在 `session_guard()` 通过后输出；
   - 仅在首页用 JS / CSS 遮罩、或只检查 localStorage 都不算保护——直接打开内容地址必须仍然返回 401；
   - 新增受保护接口时，在输出前调用 `session_guard()`，业务 API 继续走后端 token 中间件。

1. **localStorage**：localStorage 中的 token 只用于业务 API 调用，不是访问控制依据；真正的凭证是服务端 HttpOnly 会话
2. **CORS问题**：如果后端API在不同域名，需要配置CORS
3. **HTTPS**：生产环境建议使用HTTPS，并将 `config.php` 中 `session.cookie_secure` 置为 1
4. **错误日志**：检查PHP错误日志以排查问题
5. **性能优化**：会话守卫每次内容请求都会校验卡密状态（封禁/过期可即时生效），请勿在守卫前加可绕过校验的长缓存

## 故障排除

### 1. 页面404错误

- 检查 `.htaccess` 是否生效
- 确认Apache已启用 `mod_rewrite`
- 检查虚拟主机配置

### 2. API调用失败

- 检查后端API是否运行
- 确认 `$API_BASE_URL` 配置正确
- 查看PHP错误日志

### 3. localStorage问题

- 清除浏览器本地存储后重试
- 确认登录后已写入token

### 4. 样式不显示

- 检查 `/assets/css/styles.css` 路径
- 确认文件权限
- 清除浏览器缓存

## 总结

当前 PHP 前端实现包含以下能力：

- ✅ 完整的路由系统
- ✅ 认证和授权
- ✅ 心跳检测
- ✅ Toast通知
- ✅ 表单验证
- ✅ 加载状态
- ✅ 防调试保护
- ✅ 响应式UI
- ✅ 所有动画效果

可以直接部署使用，无需任何构建工具。
