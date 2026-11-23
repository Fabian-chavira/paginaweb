/* Protección y seguridad en sistemas operativos — interacciones de la página */
(function () {
  "use strict";

  /* ---------- Utilidades ---------- */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") el.className = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  function fillSelect(select, items, selectedIndex) {
    select.innerHTML = "";
    items.forEach(function (it, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = it;
      if (i === selectedIndex) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function result(kind, who, verdict, text) {
    return h("div", { class: "result " + kind }, [
      h("div", { class: "who", text: who }),
      h("div", { class: "verdict", text: verdict }),
      h("p", { text: text })
    ]);
  }

  /* ---------- Tema claro / oscuro ---------- */

  var root = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return media ? media.matches : false;
  }

  function refreshThemeBtn() {
    var dark = isDark();
    themeBtn.setAttribute("aria-pressed", String(dark));
    themeBtn.textContent = dark ? "Modo claro" : "Modo oscuro";
  }

  var saved = null;
  try { saved = localStorage.getItem("tema"); } catch (e) { saved = null; }
  if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  refreshThemeBtn();

  themeBtn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("tema", next); } catch (e) { /* sin almacenamiento */ }
    refreshThemeBtn();
  });

  if (media && media.addEventListener) {
    media.addEventListener("change", refreshThemeBtn);
  }

  /* ---------- Navegación: tema activo ---------- */

  var nav = document.querySelector(".nav");
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });

  function setCurrent(id) {
    var target = byId[id];
    links.forEach(function (l) { l.removeAttribute("aria-current"); });
    if (!target) return;
    target.setAttribute("aria-current", "true");
    var left = target.offsetLeft - nav.clientWidth / 2 + target.clientWidth / 2;
    nav.scrollTo({ left: left, behavior: "smooth" });
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) setCurrent(e.target.id);
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll("main section[id]").forEach(function (s) { io.observe(s); });
  }

  /* ---------- 6.2 Modelos Bell-LaPadula y Biba ---------- */

  (function niveles() {
    var NIVELES = ["Sin clasificar", "Confidencial", "Secreto", "Ultrasecreto"];
    var selU = document.getElementById("nivUser");
    var selD = document.getElementById("nivDoc");
    var selO = document.getElementById("nivOp");
    var out = document.getElementById("nivOut");
    if (!selU || !selD || !selO || !out) return;

    fillSelect(selU, NIVELES, 1);
    fillSelect(selD, NIVELES, 2);

    function render() {
      var u = parseInt(selU.value, 10);
      var d = parseInt(selD.value, 10);
      var op = selO.value;
      var nu = NIVELES[u];
      var nd = NIVELES[d];

      // Bell-LaPadula (confidencialidad): leer si u >= d; escribir si u <= d.
      var blp = op === "leer" ? u >= d : u <= d;
      var blpTxt;
      if (op === "leer") {
        blpTxt = blp
          ? "«" + nu + "» puede leer un documento «" + nd + "» porque su nivel es igual o mayor."
          : "«" + nu + "» no puede leer hacia arriba: el documento «" + nd + "» es más sensible que su nivel.";
      } else {
        blpTxt = blp
          ? "«" + nu + "» puede escribir en un documento «" + nd + "» porque no baja información a un nivel inferior."
          : "«" + nu + "» no puede escribir hacia abajo: pasaría información de «" + nu + "» a un nivel menor («" + nd + "»).";
      }

      // Biba (integridad): leer si d >= u (no leer hacia abajo); escribir si u >= d (no escribir hacia arriba).
      var biba = op === "leer" ? d >= u : u >= d;
      var bibaTxt;
      if (op === "leer") {
        bibaTxt = biba
          ? "Leer es seguro: el documento («" + nd + "») es igual o más confiable que el usuario («" + nu + "»)."
          : "No puede leer hacia abajo: «" + nd + "» es menos confiable que «" + nu + "» y podría contaminar su trabajo.";
      } else {
        bibaTxt = biba
          ? "Puede escribir: su nivel («" + nu + "») es igual o mayor que el del documento («" + nd + "»)."
          : "No puede escribir hacia arriba: «" + nu + "» es menos confiable que «" + nd + "» y podría alterar datos de mayor confianza.";
      }

      out.innerHTML = "";
      out.appendChild(result(blp ? "ok" : "bad", "Bell-LaPadula (confidencialidad)", blp ? "Permitido" : "Denegado", blpTxt));
      out.appendChild(result(biba ? "ok" : "bad", "Biba (integridad)", biba ? "Permitido" : "Denegado", bibaTxt));
    }

    [selU, selD, selO].forEach(function (s) { s.addEventListener("change", render); });
    render();
  })();

  /* ---------- 6.4 Matriz de acceso ---------- */

  (function matriz() {
    var DOMINIOS = ["Alumno", "Profesor", "Administrador"];
    var OBJETOS = ["Calificaciones.xls", "Tarea.docx", "Impresora"];
    var DERECHOS = ["leer", "escribir", "imprimir", "administrar"];
    var M = {
      "Alumno": { "Calificaciones.xls": ["leer"], "Tarea.docx": ["leer", "escribir"], "Impresora": ["imprimir"] },
      "Profesor": { "Calificaciones.xls": ["leer", "escribir"], "Tarea.docx": ["leer"], "Impresora": ["imprimir"] },
      "Administrador": { "Calificaciones.xls": ["leer"], "Tarea.docx": [], "Impresora": ["imprimir", "administrar"] }
    };

    var cont = document.getElementById("matrizVista");
    var tabs = document.querySelectorAll("#demoMatriz .tabs button");
    var selDom = document.getElementById("mDom");
    var selObj = document.getElementById("mObj");
    var selDer = document.getElementById("mDer");
    var out = document.getElementById("mOut");
    if (!cont || !selDom || !selObj || !selDer || !out) return;

    function rightsText(arr) { return arr.length ? arr.join(", ") : "—"; }

    function vistaMatriz() {
      var thead = h("thead", null, [h("tr", null,
        [h("th", { scope: "col", text: "Dominio \\ Objeto" })].concat(
          OBJETOS.map(function (o) { return h("th", { scope: "col", text: o }); })
        )
      )]);
      var tbody = h("tbody", null, DOMINIOS.map(function (d) {
        return h("tr", null, [h("th", { scope: "row", text: d })].concat(
          OBJETOS.map(function (o) {
            var r = M[d][o];
            return h("td", { class: r.length ? "rights" : "empty", text: rightsText(r) });
          })
        ));
      }));
      var table = h("table", null, [
        h("caption", { text: "Matriz de acceso: filas = dominios, columnas = objetos" }),
        thead, tbody
      ]);
      return h("div", { class: "table-scroll" }, [table]);
    }

    function vistaAcl() {
      var wrap = h("div", { class: "list-view" });
      OBJETOS.forEach(function (o) {
        var ul = h("ul");
        var any = false;
        DOMINIOS.forEach(function (d) {
          if (M[d][o].length) { any = true; ul.appendChild(h("li", { text: d + ": " + M[d][o].join(", ") })); }
        });
        if (!any) ul.appendChild(h("li", { text: "Nadie tiene acceso" }));
        wrap.appendChild(h("div", { class: "card" }, [h("span", { class: "tag", text: "ACL del objeto" }), h("h4", { text: o }), ul]));
      });
      return wrap;
    }

    function vistaCap() {
      var wrap = h("div", { class: "list-view" });
      DOMINIOS.forEach(function (d) {
        var ul = h("ul");
        var any = false;
        OBJETOS.forEach(function (o) {
          if (M[d][o].length) { any = true; ul.appendChild(h("li", { text: o + ": " + M[d][o].join(", ") })); }
        });
        if (!any) ul.appendChild(h("li", { text: "Sin capacidades" }));
        wrap.appendChild(h("div", { class: "card" }, [h("span", { class: "tag", text: "Capacidades del dominio" }), h("h4", { text: d }), ul]));
      });
      return wrap;
    }

    function mostrar(vista) {
      cont.innerHTML = "";
      cont.appendChild(vista === "acl" ? vistaAcl() : vista === "cap" ? vistaCap() : vistaMatriz());
      Array.prototype.forEach.call(tabs, function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-vista") === vista));
      });
    }

    Array.prototype.forEach.call(tabs, function (b) {
      b.addEventListener("click", function () { mostrar(b.getAttribute("data-vista")); });
    });

    fillSelect(selDom, DOMINIOS, 0);
    fillSelect(selObj, OBJETOS, 0);
    fillSelect(selDer, DERECHOS, 1);

    function verificar() {
      var d = DOMINIOS[parseInt(selDom.value, 10)];
      var o = OBJETOS[parseInt(selObj.value, 10)];
      var r = DERECHOS[parseInt(selDer.value, 10)];
      var ok = M[d][o].indexOf(r) !== -1;
      var txt = ok
        ? "La celda (" + d + ", " + o + ") incluye el derecho «" + r + "»."
        : "La celda (" + d + ", " + o + ") contiene: " + rightsText(M[d][o]) + ". No incluye «" + r + "».";
      out.innerHTML = "";
      out.appendChild(result(ok ? "ok" : "bad", d + " → " + r + " → " + o, ok ? "Permitido" : "Denegado", txt));
    }

    [selDom, selObj, selDer].forEach(function (s) { s.addEventListener("change", verificar); });
    mostrar("matriz");
    verificar();
  })();

  /* ---------- 6.7 Cifrado César ---------- */

  (function cesar() {
    var txt = document.getElementById("cTexto");
    var rng = document.getElementById("cClave");
    var val = document.getElementById("cClaveVal");
    var out = document.getElementById("cSalida");
    var btns = document.querySelectorAll("#demoCesar .seg button");
    if (!txt || !rng || !val || !out) return;
    var modo = "cifrar";

    function desplazar(s, k) {
      var res = "";
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 65 && c <= 90) res += String.fromCharCode(((c - 65 + k) % 26 + 26) % 26 + 65);
        else if (c >= 97 && c <= 122) res += String.fromCharCode(((c - 97 + k) % 26 + 26) % 26 + 97);
        else res += s.charAt(i);
      }
      return res;
    }

    function render() {
      var k = parseInt(rng.value, 10);
      val.textContent = String(k);
      out.textContent = desplazar(txt.value, modo === "cifrar" ? k : -k);
    }

    txt.addEventListener("input", render);
    rng.addEventListener("input", render);
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener("click", function () {
        modo = b.getAttribute("data-modo");
        Array.prototype.forEach.call(btns, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        render();
      });
    });
    render();
  })();

  /* ---------- 6.7 Hash SHA-256 ---------- */

  (function hash() {
    var txt = document.getElementById("hTexto");
    var out = document.getElementById("hSalida");
    if (!txt || !out) return;

    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) {
      out.textContent = "Tu navegador no permite calcular SHA-256 en esta página (hace falta abrirla por https).";
      return;
    }

    var ticket = 0;
    function render() {
      var mi = ++ticket;
      var data = new TextEncoder().encode(txt.value);
      subtle.digest("SHA-256", data).then(function (buf) {
        if (mi !== ticket) return;
        var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
        out.textContent = hex;
      });
    }

    txt.addEventListener("input", render);
    render();
  })();
})();
