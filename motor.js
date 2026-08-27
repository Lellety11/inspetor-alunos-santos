/* Motor compartilhado dos simulados e do treino.
   Usado por simulado.html, simulado2.html e treino.html.

   MOTOR.iniciar({
     chave:   chave do localStorage onde as respostas ficam salvas
     alvo:    id do elemento onde a prova é desenhada
     grupos:  [{ nome, peso, texto?, questoes: [{ id, e, a:[4], c, m }] }]
     rotulos: { titulo?, vazio? }   textos do painel de resultado
   })

   MOTOR.ler(chave) devolve { r: {id: escolha}, c: corrigido } ou null.
*/
var MOTOR = (function () {
  "use strict";

  var LETRAS = ["A", "B", "C", "D"];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function ler(chave) {
    try {
      var raw = localStorage.getItem(chave);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d.r !== "object" || d.r === null) return null;
      return { r: d.r, c: !!d.c };
    } catch (e) { return null; }
  }

  function iniciar(cfg) {
    var grupos = cfg.grupos;
    var chave = cfg.chave;
    var rotulos = cfg.rotulos || {};
    var main = document.getElementById(cfg.alvo);

    var respostas = {};
    var corrigido = false;
    var salvo = ler(chave);
    if (salvo) { respostas = salvo.r; corrigido = salvo.c; }

    var total = 0, pontosMax = 0;
    grupos.forEach(function (g) {
      total += g.questoes.length;
      pontosMax += g.questoes.length * g.peso;
    });

    if (!total) {
      main.innerHTML = rotulos.vazio || "";
      var barraVazia = document.querySelector(".barra");
      if (barraVazia) barraVazia.style.display = "none";
      return;
    }

    function salvar() {
      try { localStorage.setItem(chave, JSON.stringify({ r: respostas, c: corrigido })); } catch (e) { /* ignorado */ }
    }

    /* ---------- desenho ---------- */
    var html = "";
    var n = 0;
    grupos.forEach(function (g, gi) {
      var pontos = g.questoes.length * g.peso;
      html += '<section class="bloco" id="bl-' + gi + '">';
      html += '<div class="bloco-head"><h2>' + esc(g.nome) + '</h2>' +
              '<div class="bloco-pts' + (g.peso === 4 ? " hot" : "") + '">' + pontos +
              '<small>pontos · ' + g.questoes.length + ' quest' + (g.questoes.length === 1 ? "ão" : "ões") +
              ' · peso ' + g.peso + '</small></div></div>';
      if (g.texto) html += '<div class="texto-base">' + g.texto + "</div>";

      g.questoes.forEach(function (q) {
        n++;
        html += '<article class="q" id="q-' + q.id + '" data-id="' + q.id + '" data-c="' + q.c + '">';
        html += '<div class="q-head"><span class="q-n">' + (n < 10 ? "0" + n : n) + "</span>" +
                '<p class="q-txt">' + esc(q.e) +
                (q.origem ? '<span class="origem">' + esc(q.origem) + "</span>" : "") +
                "</p></div>";
        html += "<fieldset><legend>Questão " + n + "</legend>";
        q.a.forEach(function (alt, ai) {
          html += '<label class="alt" data-i="' + ai + '">' +
                  '<input type="radio" name="' + q.id + '" value="' + ai + '">' +
                  '<span class="letra">' + LETRAS[ai] + "</span>" +
                  "<span>" + esc(alt) + "</span></label>";
        });
        html += "</fieldset>";
        html += '<div class="coment"><span class="cm-label">Gabarito: ' + LETRAS[q.c] +
                "</span><p>" + q.m + "</p></div>";
        html += "</article>";
      });
      html += "</section>";
    });
    main.innerHTML = html;

    Object.keys(respostas).forEach(function (id) {
      var input = main.querySelector('input[name="' + id + '"][value="' + respostas[id] + '"]');
      if (input) input.checked = true;
    });

    /* ---------- progresso ---------- */
    function atualizar() {
      var feitas = 0;
      grupos.forEach(function (g) {
        g.questoes.forEach(function (q) { if (respostas.hasOwnProperty(q.id)) feitas++; });
      });
      var txt = document.getElementById("progTxt");
      var fill = document.getElementById("progFill");
      var btn = document.getElementById("btnCorrigir");
      if (txt) txt.textContent = corrigido ? "Corrigido" : feitas + " de " + total + " respondidas";
      if (fill) fill.style.width = (feitas / total * 100) + "%";
      if (btn) btn.disabled = corrigido || feitas === 0;
    }

    main.addEventListener("change", function (ev) {
      if (corrigido || !ev.target.matches('input[type="radio"]')) return;
      respostas[ev.target.name] = Number(ev.target.value);
      salvar();
      atualizar();
    });

    /* ---------- correção ---------- */
    function corrigir(silencioso) {
      corrigido = true;
      salvar();

      var placar = [], pontos = 0, acertos = 0;
      grupos.forEach(function (g) {
        var certas = 0;
        g.questoes.forEach(function (q) {
          var el = document.getElementById("q-" + q.id);
          var escolha = respostas.hasOwnProperty(q.id) ? respostas[q.id] : null;
          var certo = escolha === q.c;
          if (certo) certas++;

          el.classList.add("done");
          el.querySelectorAll('input[type="radio"]').forEach(function (i) { i.disabled = true; });
          el.querySelectorAll(".alt").forEach(function (lab) {
            var i = Number(lab.dataset.i);
            if (i === q.c) lab.classList.add("is-right");
            else if (i === escolha) lab.classList.add("is-wrong");
          });
          el.querySelector(".q-n").classList.add(certo ? "hit" : "miss");
        });
        pontos += certas * g.peso;
        acertos += certas;
        placar.push({ nome: g.nome, peso: g.peso, acertos: certas, q: g.questoes.length,
                      pontos: certas * g.peso, max: g.questoes.length * g.peso });
      });

      resultado(placar, pontos, acertos);
      atualizar();
      if (!silencioso) {
        document.getElementById("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function resultado(placar, pontos, acertos) {
      var nota100 = Math.round(pontos / pontosMax * 100);
      var passou = nota100 >= 50;
      var veredito, detalhe;

      if (cfg.veredito) {
        var v = cfg.veredito(nota100, acertos, total, placar);
        veredito = v.titulo; detalhe = v.texto;
      } else if (nota100 >= 70) {
        veredito = "Nota de aprovação com folga.";
        detalhe = "Acima de 70 pontos a disputa deixa de ser pela habilitação e passa a ser pela posição na lista. Concentre as revisões nos blocos de peso 4.";
      } else if (passou) {
        veredito = "Acima do mínimo de habilitação.";
        detalhe = "São necessários 50 pontos para não ser eliminada — mas ainda é preciso estar entre as 220 primeiras da lista geral. Cada acerto a mais em Legislação ou Conhecimentos Específicos vale 4 pontos.";
      } else {
        veredito = "Abaixo do mínimo de habilitação.";
        detalhe = "São necessários 50 pontos. Olhe a tabela: quase sempre a diferença está nos dois blocos de peso 4, onde cada questão vale por quatro de Português.";
      }

      var linhas = "";
      placar.forEach(function (b) {
        var forte = (b.peso === 4 && b.acertos / b.q < 0.6) ? ' style="font-weight:600"' : "";
        linhas += "<tr" + forte + "><td>" + esc(b.nome) + "</td>" +
                  '<td class="num">' + b.acertos + "/" + b.q + "</td>" +
                  '<td class="num">' + b.peso + "</td>" +
                  '<td class="num">' + b.pontos + " / " + b.max + "</td></tr>";
      });

      var foco = placar.filter(function (b) { return b.peso === 4 && b.acertos / b.q < 0.7; })
                       .map(function (b) { return b.nome; });
      var focoHtml = foco.length
        ? '<div class="note"><span class="eyebrow" style="color:var(--alert)">Onde voltar primeiro</span><p>' +
          esc(foco.join(" e ")) + ". Cada questão desses blocos vale <strong>4 pontos</strong> — " +
          "recuperar três delas rende mais que gabaritar Matemática inteira.</p></div>"
        : '<div class="note"><span class="eyebrow">Boa notícia</span><p>Os blocos de peso 4 estão acima de 70% de acerto. ' +
          "É exatamente onde a prova é decidida.</p></div>";

      document.getElementById("resultado").innerHTML =
        '<div class="score-card">' +
          '<span class="eyebrow">' + esc(rotulos.titulo || "Resultado") + "</span>" +
          '<div class="score-top">' +
            '<span class="score-big ' + (passou ? "pass" : "fail") + '">' + pontos +
              '<span style="font-size:1.1rem;color:var(--ink-3)"> / ' + pontosMax + "</span></span>" +
            '<span class="score-sub">' + acertos + " de " + total + " questões certas" +
              (pontosMax === 100 ? "<br>mínimo para habilitação: <strong>50 pontos</strong>" : "") + "</span>" +
          "</div>" +
          '<p class="veredito">' + veredito + "</p>" +
          '<p class="fine">' + detalhe + "</p>" +
          '<div class="tw"><table><thead><tr><th>Bloco</th><th class="num">Acertos</th>' +
            '<th class="num">Peso</th><th class="num">Pontos</th></tr></thead><tbody>' + linhas +
            '<tr class="total"><td>Total</td><td class="num">' + acertos + "/" + total +
            '</td><td class="num">—</td><td class="num">' + pontos + " / " + pontosMax + "</td></tr>" +
          "</tbody></table></div>" +
          focoHtml +
          '<p class="fine">Os comentários de cada questão apareceram acima. Vale copiar à mão, no caderno de erros, ' +
          "o motivo de cada questão errada — é esse caderno que se relê na véspera.</p>" +
        "</div>";
      document.getElementById("resultado").classList.add("show");
    }

    /* ---------- botões ---------- */
    var btnC = document.getElementById("btnCorrigir");
    if (btnC) btnC.addEventListener("click", function () { corrigir(false); });

    var btnL = document.getElementById("btnLimpar");
    if (btnL) btnL.addEventListener("click", function () {
      if (!confirm("Apagar todas as respostas e recomeçar?")) return;
      try { localStorage.removeItem(chave); } catch (e) { /* ignorado */ }
      location.reload();
    });

    atualizar();
    if (corrigido) corrigir(true);
  }

  return { iniciar: iniciar, ler: ler };
})();
