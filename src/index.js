var doc = require('global/document');
var win = require('global/window');
var createElement = require('virtual-dom/create-element');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var h = require('virtual-dom/h');
var debounce = require('debounce');
var xtend = require('xtend');
var mean = require('compute-mean');
var median = require('compute-median');
var mode = require('compute-mode');
var unlerp = require('unlerp');
var lerp = require('lerp');
var unified = require('unified');
var english = require('retext-english');
var visit = require('unist-util-visit');
var toString = require('nlcst-to-string');
var normalize = require('nlcst-normalize');
var syllable = require('syllable');
var spache = require('spache');
var daleChall = require('dale-chall');
var daleChallFormula = require('dale-chall-formula');
var ari = require('automated-readability');
var colemanLiau = require('coleman-liau');
var flesch = require('flesch');
var smog = require('smog-formula');
var gunningFog = require('gunning-fog');
var spacheFormula = require('spache-formula');

var averages = {
  mean: mean,
  median: median,
  mode: modeMean
};

var types = {
  sentence: 'SentenceNode',
  paragraph: 'ParagraphNode'
};

var minAge = 5;
var maxAge = 22;
var defaultAge = 12;
var scale = 6;

var max = Math.max;
var min = Math.min;
var floor = Math.floor;
var round = Math.round;
var ceil = Math.ceil;
var sqrt = Math.sqrt;

var processor = unified().use(english);
var main = doc.getElementsByTagName('main')[0];
var templates = [].slice.call(doc.getElementsByTagName('template'));

var state = {
  type: 'SentenceNode',
  average: 'median',
  template: optionForTemplate(templates[0]),
  value: valueForTemplate(templates[0]),
  age: defaultAge
};

var tree = render(state);
var dom = main.appendChild(createElement(tree));

function onchangevalue(ev) {
  var prev = state.value;
  var next = ev.target.value;

  if (prev !== next) {
    state.value = next;
    state.template = null;
    onchange();
  }
}

function onchangeaverage(ev) {
  state.average = ev.target.value.toLowerCase();
  onchange();
}

function onchangetype(ev) {
  state.type = types[ev.target.value.toLowerCase()];
  onchange();
}

function onchangetemplate(ev) {
  var target = ev.target.selectedOptions[0];
  var node = doc.querySelector('[data-label="' + target.textContent + '"]');
  state.template = optionForTemplate(node);
  state.value = valueForTemplate(node);
  onchange();
}

function onchangeage(ev) {
  state.age = Number(ev.target.value);
  onchange();
}

function onchange() {
  var next = render(state);
  dom = patch(dom, diff(tree, next));
  tree = next;
}

function render(state) {
  var tree = processor.runSync(processor.parse(state.value));
  var change = debounce(onchangevalue, 4);
  var changeage = debounce(onchangeage, 4);
  var key = 0;
  var unselected = true;
  var options = templates.map(function (template, index) {
    var selected = optionForTemplate(template) === state.template;

    if (selected) {
      unselected = false;
    }

    return h('option', {key: index, selected: selected}, optionForTemplate(template));
  });

  setTimeout(resize, 4);

  return h('div', [
    h('section.highlight', [
      h('h1', {key: 'title'}, 'Readability')
    ]),
    h('div', {key: 'editor', className: 'editor'}, [
      h('div', {key: 'draw', className: 'draw'}, pad(all(tree, []))),
      h('textarea', {
        key: 'area',
        value: state.value,
        oninput: change,
        onpaste: change,
        onkeyup: change,
        onmouseup: change
      })
    ]),
    h('section.highlight', [
      h('p', {key: 'byline'}, [
        'This project measures readability in text with several formulas: ',
        h('a', {href: 'https://en.wikipedia.org/wiki/Dale–Chall_readability_formula'}, 'Dale–Chall'),
        ', ',
        h('a', {href: 'https://en.wikipedia.org/wiki/Automated_readability_index'}, 'Automated Readability'),
        ', ',
        h('a', {href: 'https://en.wikipedia.org/wiki/Coleman–Liau_index'}, 'Coleman–Liau'),
        ', ',
        h('a', {href: 'https://en.wikipedia.org/wiki/Flesch–Kincaid_readability_tests#Flesch_reading_ease'}, 'Flesch'),
        ', ',
        h('a', {href: 'https://en.wikipedia.org/wiki/Gunning_fog_index'}, 'Gunning fog'),
        ', ',
        h('a', {href: 'https://en.wikipedia.org/wiki/SMOG'}, 'SMOG'),
        ', and ',
        h('a', {href: 'https://en.wikipedia.org/wiki/Spache_readability_formula'}, 'Spache'),
        '.'
      ]),
      h('p', {key: 'ps'}, [
        'You can edit the text above, or pick a template: ',
        h('select', {key: 'template', onchange: onchangetemplate}, [
          unselected ? h('option', {key: '-1', selected: unselected}, '--') : null
        ].concat(options)),
        '.'
      ]),
      h('p', {key: 2}, [
        'You can choose which target age you want to reach (now at ',
        h('input', {
          type: 'number',
          min: minAge,
          max: maxAge,
          oninput: changeage,
          onpaste: changeage,
          onkeyup: changeage,
          onmouseup: changeage,
          attributes: {
            value: defaultAge
          }
        }),
        '), and text will be highlighted in green if the text matches that (albeit if ',
        'they’re still in school). Red means it would take 6 years longer in school ',
        '(so an age of ',
        h('span', {
          title: 'Using the previous input updates the value reflected here'
        }, String(state.age + 6)),
        '), and the years between them mix gradually between green and red.'
      ]),
      h('p', {key: 3}, [
        'You can pick which average to use (currently ',
        h('select', {key: 'average', onchange: onchangeaverage}, [
          h('option', {key: 0}, 'mean'),
          h('option', {key: 1, selected: true}, 'median'),
          h('option', {key: 2}, 'mode')
        ]),
        ').'
      ]),
      h('p', {key: 4}, [
        'It’s now highlighting per ',
        h('select', {key: 'type', onchange: onchangetype}, [
          h('option', {key: 0}, 'paragraph'),
          h('option', {key: 1, selected: true}, 'sentence')
        ]),
        ', but you can change that.'
      ])
    ]),
    h('section.credits', {key: 'credits'}, [
      h('p', [
        h('a', {href: 'https://github.com/wooorm/readability'}, 'Fork this website'),
        ' • ',
        h('a', {href: 'https://github.com/wooorm/readability/blob/src/LICENSE'}, 'MIT'),
        ' • ',
        h('a', {href: 'http://wooorm.com'}, '@wooorm')
      ])
    ])
  ]);

  function all(node, parentIds) {
    var children = node.children;
    var length = children.length;
    var index = -1;
    var results = [];

    while (++index < length) {
      results = results.concat(one(children[index], parentIds.concat(index)));
    }

    return results;
  }

  function one(node, parentIds) {
    var result = 'value' in node ? node.value : all(node, parentIds);
    var id = parentIds.join('-') + '-' + key;
    var attrs = node.type === state.type ? highlight(node) : null;

    if (attrs) {
      result = h('span', xtend({key: id, id: id}, attrs), result);
      key++;
    }

    return result;
  }

  /* Trailing white-space in a `textarea` is shown, but not in a `div`
   * with `white-space: pre-wrap`. Add a `br` to make the last newline
   * explicit. */
  function pad(nodes) {
    var tail = nodes[nodes.length - 1];

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}));
    }

    return nodes;
  }
}

/* Highlight a section. */
function highlight(node) {
  var familiarWords = {};
  var easyWord = {};
  var complexPolysillabicWord = 0;
  var familiarWordCount = 0;
  var polysillabicWord = 0;
  var syllableCount = 0;
  var easyWordCount = 0;
  var wordCount = 0;
  var letters = 0;
  var sentenceCount = 0;
  var counts;
  var average;
  var weight;
  var hue;

  visit(node, 'SentenceNode', sentence);
  visit(node, 'WordNode', word);

  counts = {
    complexPolysillabicWord: complexPolysillabicWord,
    polysillabicWord: polysillabicWord,
    unfamiliarWord: wordCount - familiarWordCount,
    difficultWord: wordCount - easyWordCount,
    syllable: syllableCount,
    sentence: sentenceCount,
    word: wordCount,
    character: letters,
    letter: letters
  };

  average = averages[state.average]([
    gradeToAge(daleChallFormula.gradeLevel(daleChallFormula(counts))[1]),
    gradeToAge(ari(counts)),
    gradeToAge(colemanLiau(counts)),
    fleschToAge(flesch(counts)),
    smogToAge(smog(counts)),
    gradeToAge(gunningFog(counts)),
    gradeToAge(spacheFormula(counts))
  ]);

  weight = unlerp(state.age, state.age + scale, average);
  hue = lerp(120, 0, min(1, max(0, weight)));

  return {
    style: {
      backgroundColor: 'hsl(' + [hue, '93%', '85%'].join(', ') + ')'
    }
  };

  function sentence() {
    sentenceCount++;
  }

  function word(node) {
    var value = toString(node);
    var syllables = syllable(value);
    var normalized = normalize(node, {allowApostrophes: true});
    var head;

    wordCount++;
    syllableCount += syllables;
    letters += value.length;

    /* Count complex words for gunning-fog based on
     * whether they have three or more syllables
     * and whether they aren’t proper nouns.  The
     * last is checked a little simple, so this
     * index might be over-eager. */
    if (syllables >= 3) {
      polysillabicWord++;
      head = value.charAt(0);

      if (head === head.toLowerCase()) {
        complexPolysillabicWord++;
      }
    }

    /* Find unique unfamiliar words for spache. */
    if (spache.indexOf(normalized) !== -1 && familiarWords[normalized] !== true) {
      familiarWords[normalized] = true;
      familiarWordCount++;
    }

    /* Find unique difficult words for dale-chall. */
    if (daleChall.indexOf(normalized) !== -1 && easyWord[normalized] !== true) {
      easyWord[normalized] = true;
      easyWordCount++;
    }
  }
}

/* Calculate the typical starting age (on the higher-end) when
 * someone joins `grade` grade, in the US.
 * See https://en.wikipedia.org/wiki/Educational_stage#United_States. */
function gradeToAge(grade) {
  return round(grade + 5);
}

/* Calculate the age relating to a Flesch result. */
function fleschToAge(value) {
  return 20 - floor(value / 10);
}

/* Calculate the age relating to a SMOG result.
 * See http://www.readabilityformulas.com/smog-readability-formula.php. */
function smogToAge(value) {
  return ceil(sqrt(value) + 2.5);
}

function rows(node) {
  if (!node) {
    return;
  }

  return ceil(
    node.getBoundingClientRect().height /
    parseInt(win.getComputedStyle(node).lineHeight, 10)
  ) + 1;
}

function optionForTemplate(template) {
  return template.dataset.label;
}

function valueForTemplate(template) {
  return template.innerHTML + '\n\n— ' + optionForTemplate(template);
}

function resize() {
  dom.querySelector('textarea').rows = rows(dom.querySelector('.draw'));
}

function modeMean(value) {
  return mean(mode(value));
}
