/* =========================================================================
   零依赖 Markdown 解析器
   支持：标题 / 段落 / 嵌套列表 / 围栏代码块(语法高亮) / 引用 /
        表格 / 图片 / 链接 / 粗体 / 斜体 / 删除线 / 行内代码 / 水平线
   暴露：window.MD.parse(text, baseDir) -> { html, toc }
    - baseDir：当前 .md 文件所在目录，用于解析相对图片/链接路径
    - toc：标题列表 [{level, text, id}]，供右侧目录使用
   ========================================================================= */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function isExternal(u) {
    return /^(https?:|mailto:|tel:|\/\/)/i.test(u);
  }
  function slugify(text) {
    return String(text).toLowerCase().trim()
      .replace(/[^\w\u4e00-\u9fff\-\s]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  }
  // 将相对路径基于 baseDir 归一化（baseDir 以 / 结尾）
  function resolvePath(baseDir, url) {
    if (/^(https?:|mailto:|tel:|#|data:|[a-z]+:\/\/|\/\/)/i.test(url)) return url;
    var parts = (baseDir + url).split("/");
    var stack = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === "" || p === ".") continue;
      if (p === "..") stack.pop();
      else stack.push(p);
    }
    return stack.join("/");
  }

  // 行内解析：先整体转义，再按命名分组一次性包裹
  var INLINE = /(?<image>!\[([^\]]*)\]\(([^)]+)\))|(?<link>\[([^\]]+)\]\(([^)]+)\))|(?<bold>\*\*([^*]+)\*\*)|(?<strike>~~([^~]+)~~)|(?<italic>\*([^*]+)\*)|(?<code>`([^`]+)`)/g;

  function parseInline(raw, baseDir) {
    var s = escapeHtml(raw);
    return s.replace(INLINE, function () {
      var g = arguments[arguments.length - 1];
      var m = arguments[0];
      if (g.image) {
        var im = m.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        return '<img src="' + escAttr(resolvePath(baseDir, im[2])) + '" alt="' + escAttr(im[1]) + '" loading="lazy">';
      }
      if (g.link) {
        var lm = m.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        var href = resolvePath(baseDir, lm[2]);
        var ext = isExternal(lm[2]) ? ' target="_blank" rel="noopener noreferrer"' : "";
        return '<a href="' + escAttr(href) + '"' + ext + ">" + lm[1] + "</a>";
      }
      if (g.bold) return "<strong>" + m.slice(2, -2) + "</strong>";
      if (g.strike) return "<del>" + m.slice(2, -2) + "</del>";
      if (g.italic) return "<em>" + m.slice(1, -1) + "</em>";
      if (g.code) return "<code>" + m.slice(1, -1) + "</code>";
      return m;
    });
  }

  function renderTable(rows, baseDir) {
    var splitRow = function (r) {
      r = r.trim().replace(/^\|/, "").replace(/\|$/, "");
      return r.split("|").map(function (c) { return c.trim(); });
    };
    var header = splitRow(rows[0]);
    var body = rows.slice(1).map(splitRow);
    var html = "<table><thead><tr>";
    header.forEach(function (h) { html += "<th>" + parseInline(h, baseDir) + "</th>"; });
    html += "</tr></thead><tbody>";
    body.forEach(function (row) {
      html += "<tr>";
      for (var c = 0; c < header.length; c++) {
        html += "<td>" + (row[c] !== undefined ? parseInline(row[c], baseDir) : "") + "</td>";
      }
      html += "</tr>";
    });
    return html + "</tbody></table>";
  }

  function buildList(lines, baseDir) {
    var root = { type: null, items: [] };
    var stack = [{ indent: -1, node: root }];
    lines.forEach(function (line) {
      var m = line.match(/^(\s*)(?:([-*+])|(\d+)\.)\s+(.*)$/);
      if (!m) return;
      var indent = m[1].length;
      var ordered = !!m[3];
      var item = { text: m[4], children: { type: null, items: [] } };
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      var parent = stack[stack.length - 1].node;
      if (parent.type === null) parent.type = ordered ? "ol" : "ul";
      parent.items.push(item);
      stack.push({ indent: indent, node: item.children });
    });
    function render(node) {
      if (!node.type || !node.items.length) return "";
      var tag = node.type;
      var out = "<" + tag + ">";
      node.items.forEach(function (it) {
        out += "<li>" + parseInline(it.text.replace(/\n+/g, " "), baseDir);
        if (it.children.items.length) out += render(it.children);
        out += "</li>";
      });
      return out + "</" + tag + ">";
    }
    return render(root);
  }

  function parseBlocks(lines, baseDir, usedIds) {
    var html = "";
    var toc = [];
    var i = 0, line;
    while (i < lines.length) {
      line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      // 代码围栏
      var fence = line.match(/^(\s*)(```|~~~)\s*([\w+#-]*)\s*$/);
      if (fence) {
        var marker = fence[2], lang = fence[3] || "";
        i++; var buf = [];
        var closeRe = new RegExp("^\\s*" + marker);
        while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        var code = buf.join("\n");
        var hi = global.highlightCode ? global.highlightCode(code, lang) : escapeHtml(code);
        html += '<pre><code class="language-' + (lang || "plaintext") + '">' + hi + "</code></pre>";
        continue;
      }

      // 标题
      var h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        var level = h[1].length, raw = h[2];
        var id = slugify(raw);
        if (usedIds[id]) { usedIds[id]++; id = id + "-" + usedIds[id]; } else { usedIds[id] = 1; }
        toc.push({ level: level, text: raw, id: id });
        html += "<h" + level + ' id="' + id + '">' + parseInline(raw, baseDir) + "</h" + level + ">";
        i++; continue;
      }

      // 水平线
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html += "<hr>"; i++; continue; }

      // 引用
      if (/^\s*>/.test(line)) {
        var qbuf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { qbuf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        html += "<blockquote>" + parseBlocks(qbuf, baseDir, usedIds).html + "</blockquote>";
        continue;
      }

      // 表格
      if (line.indexOf("|") !== -1 && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf("-") !== -1) {
        var tbl = [line]; i++; i++;
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) { tbl.push(lines[i]); i++; }
        html += renderTable(tbl, baseDir);
        continue;
      }

      // 列表
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        var lbuf = [];
        while (i < lines.length) {
          if (/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
            lbuf.push(lines[i]); i++;
          } else if (lbuf.length && /^\s+\S/.test(lines[i])) {
            lbuf[lbuf.length - 1] += "\n" + lines[i]; i++;
          } else break;
        }
        html += buildList(lbuf, baseDir);
        continue;
      }

      // 段落
      var pbuf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*>/.test(lines[i]) &&
             !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) && !/^(\s*)(```|~~~)/.test(lines[i]) &&
             !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])) {
        pbuf.push(lines[i]); i++;
      }
      html += "<p>" + parseInline(pbuf.join("\n"), baseDir).replace(/\n/g, "<br>") + "</p>";
    }
    return { html: html, toc: toc };
  }

  function parse(text, baseDir) {
    if (!text) return { html: "", toc: [] };
    baseDir = baseDir || "";
    if (baseDir && baseDir.slice(-1) !== "/") baseDir += "/";
    var lines = text.replace(/\r\n?/g, "\n").split("\n");
    return parseBlocks(lines, baseDir, {});
  }

  global.MD = { parse: parse, parseInline: parseInline };
})(window);
