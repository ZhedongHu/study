/* =========================================================================
   学习中心 · 应用逻辑（零依赖）
   - 哈希路由：#/ 首页 | #/course/<id> 课程页 | #/lesson/<c>/<u>/<l> 课时页
   - 课时清单来自 content/courses.json（与代码同仓库，可自由增删改）
   - 进度 / 搜索 / 明暗主题 / 页内目录 / 移动端抽屉
   ========================================================================= */
(function () {
  "use strict";

  var CONTENT_BASE = "content/";
  var MANIFEST_URL = CONTENT_BASE + "courses.json";
  var PROGRESS_KEY = "lms-progress";
  var THEME_KEY = "lms-theme";
  var NAV_KEY = "lms-nav-collapsed";

  var manifest = null;
  var collapsed = {};            // 课程折叠状态
  try { collapsed = JSON.parse(localStorage.getItem(NAV_KEY) || "{}"); } catch (e) {}
  var searchIndex = [];

  // DOM
  var navTree = document.getElementById("navTree");
  var content = document.getElementById("content");
  var tocEl = document.getElementById("toc");
  var navDrawer = document.getElementById("navDrawer");
  var scrim = document.getElementById("scrim");
  var snackbar = document.getElementById("snackbar");

  /* ----------------------------- 工具函数 ----------------------------- */
  function navigate(hash) { location.hash = hash; }

  function getProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function setProgress(p) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }
  function isDone(id) { return !!getProgress()[id]; }
  function toggleDone(id) {
    var p = getProgress();
    if (p[id]) delete p[id]; else p[id] = Date.now();
    setProgress(p);
  }

  function flatten(course) {
    var out = [];
    course.units.forEach(function (u) {
      u.lessons.forEach(function (l) {
        out.push({ unit: u, lesson: l });
      });
    });
    return out;
  }
  function findCourse(id) {
    return manifest.courses.filter(function (c) { return c.id === id; })[0];
  }
  function findLesson(courseId, unitId, lessonId) {
    var c = findCourse(courseId); if (!c) return null;
    var u = c.units.filter(function (x) { return x.id === unitId; })[0]; if (!u) return null;
    var l = u.lessons.filter(function (x) { return x.id === lessonId; })[0]; if (!l) return null;
    return { course: c, unit: u, lesson: l };
  }
  function courseDoneCount(course) {
    var p = getProgress(), n = 0, total = 0;
    flatten(course).forEach(function (x) { total++; if (p[x.lesson.id]) n++; });
    return { done: n, total: total };
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function highlightTerm(text, term) {
    if (!term) return esc(text);
    var idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx < 0) return esc(text);
    return esc(text.slice(0, idx)) + "<mark>" +
      esc(text.slice(idx, idx + term.length)) + "</mark>" +
      esc(text.slice(idx + term.length));
  }

  function showSnackbar(msg) {
    snackbar.textContent = msg;
    snackbar.hidden = false;
    requestAnimationFrame(function () { snackbar.classList.add("show"); });
    clearTimeout(showSnackbar._t);
    showSnackbar._t = setTimeout(function () {
      snackbar.classList.remove("show");
      setTimeout(function () { snackbar.hidden = true; }, 220);
    }, 2000);
  }

  /* ----------------------------- 主题 ----------------------------- */
  var ICON_MOON = '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>';
  var ICON_SUN = '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>';
  function resolvedTheme() {
    var a = document.documentElement.getAttribute("data-theme");
    if (a === "dark") return "dark";
    if (a === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyStoredTheme() {
    document.documentElement.setAttribute("data-theme", localStorage.getItem(THEME_KEY) || "auto");
    updateThemeIcon();
  }
  function updateThemeIcon() {
    document.getElementById("themeIcon").innerHTML = resolvedTheme() === "dark" ? ICON_SUN : ICON_MOON;
  }
  function toggleTheme() {
    var next = resolvedTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon();
  }

  /* ----------------------------- 侧边导航 ----------------------------- */
  function renderNav() {
    if (!manifest) return;
    var html = "";
    manifest.courses.forEach(function (course) {
      var isCollapsed = !!collapsed[course.id];
      var prog = courseDoneCount(course);
      html += '<div class="nav-course' + (isCollapsed ? " collapsed" : "") + '" data-course="' + esc(course.id) + '">';
      html += '<button class="nav-course__head" data-course-head="' + esc(course.id) + '" aria-expanded="' + (!isCollapsed) + '">';
      html += '<svg class="nav-course__caret" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>';
      html += '<span>' + esc(course.title) + "</span>";
      html += '<span class="nav-course__progress">' + prog.done + "/" + prog.total + "</span>";
      html += "</button>";
      if (!isCollapsed) {
        course.units.forEach(function (unit) {
          html += '<div class="nav-unit">';
          html += '<div class="nav-unit__title">' + esc(unit.title) + "</div>";
          unit.lessons.forEach(function (lesson) {
            var done = isDone(lesson.id);
            var active = (currentLessonKey === course.id + "/" + unit.id + "/" + lesson.id);
            html += '<button class="nav-lesson' + (done ? " done" : "") + (active ? " active" : "") + '" ' +
              'data-lesson="' + esc(course.id + "/" + unit.id + "/" + lesson.id) + '">';
            html += '<span class="nav-lesson__check"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>';
            html += '<span class="nav-lesson__label">' + esc(lesson.title) + "</span>";
            html += "</button>";
          });
          html += "</div>";
        });
      }
      html += "</div>";
    });
    navTree.innerHTML = html;
  }

  /* ----------------------------- 视图：首页 ----------------------------- */
  function renderHome() {
    var html = "";
    html += '<div class="content__inner">';
    html += '<h1 class="page-title">' + esc(manifest.site.title) + "</h1>";
    html += '<p class="page-subtitle">' + esc(manifest.site.description || "") + "</p>";
    html += '<div class="course-grid">';
    manifest.courses.forEach(function (course) {
      var prog = courseDoneCount(course);
      var pct = prog.total ? Math.round(prog.done / prog.total * 100) : 0;
      html += '<article class="card" data-href="#/course/' + esc(course.id) + '">';
      html += '<div class="card__media"></div>';
      html += '<div class="card__body">';
      html += '<span class="card__tag">' + esc(course.tag || "课程") + "</span>";
      html += '<h2 class="card__title">' + esc(course.title) + "</h2>";
      html += '<p class="card__summary">' + esc(course.summary || "") + "</p>";
      html += '<div class="progress-row"><div class="progress"><div class="progress__bar" style="width:' + pct + '%"></div></div>' +
        '<span class="progress-label">' + prog.done + "/" + prog.total + " 课时</span></div>";
      html += '<button class="card__action" data-href="#/course/' + esc(course.id) + '">开始学习 →</button>';
      html += "</div></article>";
    });
    html += "</div></div>";
    content.innerHTML = html;
    tocEl.innerHTML = "";
  }

  /* ----------------------------- 视图：课程页 ----------------------------- */
  function renderCourse(courseId) {
    var course = findCourse(courseId);
    if (!course) return renderHome();
    var prog = courseDoneCount(course);
    var pct = prog.total ? Math.round(prog.done / prog.total * 100) : 0;
    var html = '<div class="content__inner">';
    html += '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span>' +
      '<span class="current">' + esc(course.title) + "</span></nav>";
    html += '<h1 class="page-title">' + esc(course.title) + "</h1>";
    html += '<p class="page-subtitle">' + esc(course.summary || "") + "</p>";
    html += '<div class="progress-row"><div class="progress"><div class="progress__bar" style="width:' + pct + '%"></div></div>' +
      '<span class="progress-label">已完成 ' + prog.done + " / " + prog.total + " 课时</span></div>";

    var order = flatten(course);
    var n = 0;
    course.units.forEach(function (unit) {
      html += '<section class="unit-block">';
      html += '<h2 class="unit-block__title">' + esc(unit.title) + "</h2>";
      html += '<ul class="lesson-list">';
      unit.lessons.forEach(function (lesson) {
        n++;
        var done = isDone(lesson.id);
        html += '<li class="lesson-item' + (done ? " done" : "") + '" data-href="#/lesson/' +
          esc(course.id + "/" + unit.id + "/" + lesson.id) + '">';
        html += '<span class="lesson-item__num">' + (done ? "✓" : n) + "</span>";
        html += '<span class="lesson-item__text">';
        html += '<div class="lesson-item__title">' + esc(lesson.title) + "</div>";
        if (lesson.desc) html += '<div class="lesson-item__desc">' + esc(lesson.desc) + "</div>";
        html += "</span>";
        html += '<span class="lesson-item__arrow"><svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5v10z"/></svg></span>';
        html += "</li>";
      });
      html += "</ul></section>";
    });
    html += "</div>";
    content.innerHTML = html;
    tocEl.innerHTML = "";
  }

  /* ----------------------------- 视图：课时页 ----------------------------- */
  var currentLessonKey = "";
  var tocObserver = null;

  function renderLesson(courseId, unitId, lessonId) {
    var found = findLesson(courseId, unitId, lessonId);
    if (!found) return renderHome();
    var course = found.course, unit = found.unit, lesson = found.lesson;
    currentLessonKey = courseId + "/" + unitId + "/" + lessonId;
    renderNav();

    content.innerHTML = '<div class="content__inner"><div class="loading"><div class="spinner"></div>正在加载课时内容…</div></div>';
    tocEl.innerHTML = "";

    fetch(lesson.file).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (md) {
      var baseDir = lesson.file.substring(0, lesson.file.lastIndexOf("/") + 1);
      var parsed = window.MD.parse(md, baseDir);
      // 正文首个 h1 与课时标题重复时去掉，避免标题出现两次
      parsed.html = parsed.html.replace(/^<h1[^>]*>([\s\S]*?)<\/h1>/, function (m, inner) {
        var text = inner.replace(/<[^>]+>/g, "").trim();
        return text === lesson.title ? "" : m;
      });

      var html = '<div class="content__inner">';
      html += '<nav class="breadcrumb"><a href="#/">首页</a><span class="sep">/</span>' +
        '<a href="#/course/' + esc(course.id) + '">' + esc(course.title) + "</a>" +
        '<span class="sep">/</span><a href="#/course/' + esc(course.id) + '">' + esc(unit.title) + "</a>" +
        '<span class="sep">/</span><span class="current">' + esc(lesson.title) + "</span></nav>";
      html += '<h1 class="page-title">' + esc(lesson.title) + "</h1>";
      html += '<article class="md-content">' + parsed.html + "</article>";

      // 上一页 / 下一页
      var order = flatten(course);
      var idx = order.findIndex(function (x) { return x.lesson.id === lesson.id; });
      html += '<nav class="pager">';
      if (idx > 0) {
        var prev = order[idx - 1];
        html += '<a class="prev" data-href="#/lesson/' + esc(course.id + "/" + prev.unit.id + "/" + prev.lesson.id) + '">' +
          '<span class="dir">← 上一节</span><span class="ttl">' + esc(prev.lesson.title) + "</span></a>";
      } else { html += "<span></span>"; }
      if (idx < order.length - 1) {
        var nx = order[idx + 1];
        html += '<a class="next" data-href="#/lesson/' + esc(course.id + "/" + nx.unit.id + "/" + nx.lesson.id) + '">' +
          '<span class="dir">下一节 →</span><span class="ttl">' + esc(nx.lesson.title) + "</span></a>";
      } else { html += "<span></span>"; }
      html += "</nav>";

      // 底部：标记完成
      var done = isDone(lesson.id);
      html += '<div class="lesson-actions lesson-actions--bottom">';
      html += '<button class="btn ' + (done ? "is-done" : "btn--tonal") + '" id="doneBtn">' +
        (done ? "✓ 已完成" : "标记为已完成") + "</button>";
      html += "</div>";

      html += "</div>";
      content.innerHTML = html;

      // 完成按钮
      document.getElementById("doneBtn").addEventListener("click", function () {
        toggleDone(lesson.id);
        renderNav();
        var nowDone = isDone(lesson.id);
        this.className = "btn " + (nowDone ? "is-done" : "btn--tonal");
        this.textContent = nowDone ? "✓ 已完成" : "标记为已完成";
        showSnackbar(nowDone ? "已标记为完成" : "已取消完成标记");
      });

      renderToc(parsed.toc);
      window.scrollTo(0, 0);
    }).catch(function (err) {
      content.innerHTML = '<div class="content__inner"><div class="loading">' +
        "⚠️ 课时内容加载失败：" + esc(String(err)) +
        "<br><br>请确认 <code>" + esc(lesson.file) + "</code> 存在于仓库中，" +
        "且通过静态服务器 / GitHub Pages 访问（直接以 file:// 打开会因浏览器安全策略无法读取文件）。</div></div>";
    });
  }

  /* ----------------------------- 右侧目录 + 滚动高亮 ----------------------------- */
  function renderToc(toc) {
    if (!toc || !toc.length) { tocEl.innerHTML = ""; return; }
    var html = '<div class="toc__title">本页目录</div>';
    toc.forEach(function (h) {
      if (h.level < 2) return; // 只显示 h2/h3
      html += '<a class="lvl-' + h.level + '" data-toc="' + esc(h.id) + '">' + esc(h.text) + "</a>";
    });
    tocEl.innerHTML = html;

    if (tocObserver) tocObserver.disconnect();
    var links = tocEl.querySelectorAll("a[data-toc]");
    function onScroll() {
      var offset = 100;
      var current = null;
      toc.forEach(function (h) {
        if (h.level < 2) return;
        var el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top - offset <= 0) current = h.id;
      });
      links.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("data-toc") === current);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    tocEl._onScroll = onScroll;
  }

  /* ----------------------------- 路由 ----------------------------- */
  function route() {
    if (tocEl._onScroll) { window.removeEventListener("scroll", tocEl._onScroll); tocEl._onScroll = null; }
    var hash = location.hash || "#/";
    var parts = hash.replace(/^#\//, "").split("/").filter(Boolean);
    if (parts.length === 0) { renderHome(); }
    else if (parts[0] === "course" && parts[1]) { renderCourse(parts[1]); }
    else if (parts[0] === "lesson" && parts[1] && parts[2] && parts[3]) { renderLesson(parts[1], parts[2], parts[3]); }
    else { renderHome(); }
    closeDrawer();
  }

  /* ----------------------------- 搜索 ----------------------------- */
  var searchPanel = document.getElementById("searchPanel");
  var searchInput = document.getElementById("searchInput");
  var searchResults = document.getElementById("searchResults");

  function buildSearchIndex() {
    searchIndex = [];
    manifest.courses.forEach(function (course) {
      searchIndex.push({ kind: "course", title: course.title, crumb: "课程", href: "#/course/" + course.id, hay: (course.title + " " + (course.summary || "")).toLowerCase() });
      course.units.forEach(function (unit) {
        unit.lessons.forEach(function (lesson) {
          searchIndex.push({
            kind: "lesson", title: lesson.title, crumb: course.title + " › " + unit.title,
            href: "#/lesson/" + course.id + "/" + unit.id + "/" + lesson.id,
            hay: (lesson.title + " " + (lesson.desc || "")).toLowerCase()
          });
        });
      });
    });
  }
  function openSearch() {
    searchPanel.hidden = false;
    searchInput.value = "";
    searchResults.innerHTML = "";
    setTimeout(function () { searchInput.focus(); }, 50);
  }
  function closeSearch() { searchPanel.hidden = true; }
  function runSearch() {
    var q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.innerHTML = ""; return; }
    var results = searchIndex.filter(function (r) { return r.hay.indexOf(q) !== -1; }).slice(0, 20);
    if (!results.length) {
      searchResults.innerHTML = '<div class="search-empty">未找到与“' + esc(searchInput.value) + '”相关的内容</div>';
      return;
    }
    var html = "";
    results.forEach(function (r) {
      html += '<a class="search-result" data-href="' + esc(r.href) + '">' +
        '<div class="search-result__title">' + highlightTerm(r.title, searchInput.value) + "</div>" +
        '<div class="search-result__crumb">' + esc(r.crumb) + " › " + (r.kind === "course" ? "课程总览" : "课时") + "</div></a>";
    });
    searchResults.innerHTML = html;
  }

  /* ----------------------------- 移动端抽屉 ----------------------------- */
  function openDrawer() { document.body.classList.add("drawer-open"); }
  function closeDrawer() { document.body.classList.remove("drawer-open"); }
  // 菜单按钮：移动端打开抽屉；桌面端折叠/展开侧边目录（状态记忆）
  function toggleNav() {
    if (window.matchMedia("(max-width: 850px)").matches) {
      openDrawer();
    } else {
      var collapsed = document.body.classList.toggle("nav-collapsed");
      try { localStorage.setItem("lms-nav-collapsed", collapsed ? "1" : "0"); } catch (e) {}
    }
  }

  /* ----------------------------- 事件绑定 ----------------------------- */
  function bindEvents() {
    document.getElementById("menuBtn").addEventListener("click", toggleNav);
    document.getElementById("navClose").addEventListener("click", closeDrawer);
    scrim.addEventListener("click", closeDrawer);
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
    document.getElementById("searchBtn").addEventListener("click", openSearch);
    document.getElementById("searchClose").addEventListener("click", closeSearch);
    document.getElementById("searchScrim").addEventListener("click", closeSearch);
    searchInput.addEventListener("input", runSearch);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeSearch(); closeDrawer(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); openSearch(); }
    });

    // 导航树点击（折叠 / 跳转）
    navTree.addEventListener("click", function (e) {
      var head = e.target.closest("[data-course-head]");
      if (head) {
        var id = head.getAttribute("data-course-head");
        collapsed[id] = !collapsed[id];
        localStorage.setItem(NAV_KEY, JSON.stringify(collapsed));
        renderNav();
        return;
      }
      var lesson = e.target.closest("[data-lesson]");
      if (lesson) { navigate("#/lesson/" + lesson.getAttribute("data-lesson")); }
    });

    // 内容区跳转（卡片 / 课时项 / 翻页）
    content.addEventListener("click", function (e) {
      var t = e.target.closest("[data-href]");
      if (t) { e.preventDefault(); navigate(t.getAttribute("data-href")); }
    });

    // 目录跳转（不走 hash，避免路由冲突）
    tocEl.addEventListener("click", function (e) {
      var a = e.target.closest("[data-toc]");
      if (a) {
        var el = document.getElementById(a.getAttribute("data-toc"));
        if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
      }
    });

    // 搜索结果跳转
    searchResults.addEventListener("click", function (e) {
      var t = e.target.closest("[data-href]");
      if (t) { e.preventDefault(); closeSearch(); navigate(t.getAttribute("data-href")); }
    });

    window.addEventListener("hashchange", route);
  }

  /* ----------------------------- 启动 ----------------------------- */
  function init() {
    applyStoredTheme();
    if (localStorage.getItem("lms-nav-collapsed") === "1") document.body.classList.add("nav-collapsed");
    bindEvents();
    fetch(MANIFEST_URL).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      manifest = data;
      if (!manifest.site) manifest.site = { title: "学习中心", description: "" };
      if (!manifest.courses) manifest.courses = [];
      buildSearchIndex();
      renderNav();
      route();
    }).catch(function (err) {
      content.innerHTML = '<div class="content__inner"><div class="loading">' +
        "⚠️ 课程清单加载失败：" + esc(String(err)) +
        "<br><br>请确认 <code>content/courses.json</code> 存在且为合法 JSON，" +
        "并通过静态服务器或 GitHub Pages 访问。</div></div>";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
