/* =========================================================================
   轻量语法高亮（零依赖）
   支持常见语言：js/ts/kotlin/java/python/css/html/bash/yaml
   思路：先转义 HTML，再用命名分组正则做单次扫描包裹，避免互相覆盖
   ========================================================================= */
(function (global) {
  "use strict";

  var KEYWORDS = [
    // 通用 / JS / TS
    "const","let","var","function","return","if","else","for","while","do",
    "switch","case","break","continue","new","class","extends","super","this",
    "typeof","instanceof","in","of","await","async","yield","try","catch","finally",
    "throw","import","export","from","default","null","undefined","true","false",
    "void","delete","interface","type","enum","public","private","protected",
    "static","final","abstract","synchronized","volatile","throws",
    // Kotlin / Java
    "fun","val","var","object","companion","when","is","as","package","override",
    "internal","open","sealed","data","suspend","lateinit","by","get","set","init",
    "constructor","Unit","String","Int","Boolean","Double","Float","Long","List",
    "Map","Array","Set","Any","Nothing","MutableList","Pair","Triple",
    // Python
    "def","elif","not","and","or","with","except","raise","lambda","global",
    "nonlocal","pass","True","False","None","self","print","range","len","async",
    // 通用类型/值
    "true","false","null","undefined","None","True","False"
  ];

  var kwPattern = KEYWORDS.filter(function (w, i) { return KEYWORDS.indexOf(w) === i; })
    .sort(function (a, b) { return b.length - a.length; })
    .join("|")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // 安全转义

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightCss(code) {
    var e = escapeHtml(code);
    // 注释 -> 字符串 -> 属性名(后跟冒号) -> 数值/单位
    var re = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr|pt)?\b)|([a-z-]+(?=\s*:))/gi;
    return e.replace(re, function (m, block, str, num, prop) {
      if (block) return '<span class="tok-cm">' + block + "</span>";
      if (str) return '<span class="tok-str">' + str + "</span>";
      if (num) return '<span class="tok-num">' + num + "</span>";
      if (prop) return '<span class="tok-prop">' + prop + "</span>";
      return m;
    });
  }

  function highlightCode(code, lang) {
    if (!code) return "";
    lang = (lang || "").toLowerCase();
    if (lang === "css" || lang === "scss" || lang === "less") return highlightCss(code);

    var e = escapeHtml(code);
    var isPy = /^(py|python|sh|bash|shell|zsh|yaml|yml|toml|ini|dockerfile)$/.test(lang);
    var lineComment = isPy ? "#[^\\n]*" : "\\/\\/[^\\n]*";
    var reSrc =
      "(?<block>\\/\\*[\\s\\S]*?\\*\\/)" +
      "|(?<line>" + lineComment + ")" +
      '|(?<str>"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)' +
      "(?<num>\\b\\d+(?:\\.\\d+)?\\b)" +
      "(?<kw>\\b(?:" + kwPattern + ")\\b)";

    var re;
    try {
      re = new RegExp(reSrc, "g");
    } catch (err) {
      // 极端情况下退化：仅转义
      return e;
    }

    return e.replace(re, function () {
      var g = arguments[arguments.length - 1];
      var m = arguments[0];
      if (g.block || g.line) return '<span class="tok-cm">' + m + "</span>";
      if (g.str) return '<span class="tok-str">' + m + "</span>";
      if (g.num) return '<span class="tok-num">' + m + "</span>";
      if (g.kw) return '<span class="tok-kw">' + m + "</span>";
      return m;
    });
  }

  global.highlightCode = highlightCode;
})(window);
