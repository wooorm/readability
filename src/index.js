import doc from 'global/document.js'
import win from 'global/window.js'
import createElement from 'virtual-dom/create-element.js'
import diff from 'virtual-dom/diff.js'
import patch from 'virtual-dom/patch.js'
import h from 'virtual-dom/h.js'
import debounce from 'debounce'
import xtend from 'xtend'
import mean from 'compute-mean'
import median from 'compute-median'
import unlerp from 'unlerp'
import lerp from 'lerp'
import unified from 'unified'
import english from 'retext-english'
import stringify from 'retext-stringify'
import readabilityScores from 'readability-scores'

var averages = {
  mean,
  median,
  mode: modeMean
}

var types = {
  sentence: 'SentenceNode',
  paragraph: 'ParagraphNode'
}

var minAge = 5
var maxAge = 22
var defaultAge = 12
var scale = 6

var max = Math.max
var min = Math.min
var round = Math.round
var ceil = Math.ceil

// Mode Copyright (c) 2014. Athan Reines.
// copied from \node_modules\compute-mode\lib\index.js, plus bug fix
function mode(array) {
  if (!Array.isArray(array)) {
    throw new TypeError(
      'mode()::invalid input argument. Must provide an array.'
    )
  }

  var length = array.length
  var count = {}
  var max = 0
  var vals = []
  var value

  for (var i = 0; i < length; i++) {
    value = array[i]
    if (!count[value]) {
      count[value] = 0
    }

    count[value] += 1
    if (count[value] === max) {
      vals.push(value)
      // Fix from PR2:
    } else if (count[value] > max) {
      max = count[value]
      vals = [value]
    }
  }

  //	Return vals.sort(function sort(a, b) {
  //		return a - b
  //	})
  return vals
} // End FUNCTION mode()

var processor = unified().use(english).use(stringify)
var main = doc.querySelectorAll('main')[0]
var templates = [].slice.call(doc.querySelectorAll('template'))

var state = {
  type: 'SentenceNode',
  average: 'median',
  template: optionForTemplate(templates[0]),
  value: valueForTemplate(templates[0]),
  age: defaultAge
}

var tree = render(state)
var dom = main.appendChild(createElement(tree))

function onchangevalue(ev) {
  var previous = state.value
  var next = ev.target.value

  if (previous !== next) {
    state.value = next
    state.template = null
    onchange()
  }
}

function onchangeaverage(ev) {
  state.average = ev.target.value.toLowerCase()
  onchange()
}

function onchangetype(ev) {
  state.type = types[ev.target.value.toLowerCase()]
  onchange()
}

function onchangetemplate(ev) {
  var target = ev.target.selectedOptions[0]
  var node = doc.querySelector('[data-label="' + target.textContent + '"]')
  state.template = optionForTemplate(node)
  state.value = valueForTemplate(node)
  onchange()
}

function onchangeage(ev) {
  state.age = Number(ev.target.value)
  onchange()
}

function onchange() {
  var next = render(state)
  dom = patch(dom, diff(tree, next))
  tree = next
}

function render(state) {
  var tree = processor.runSync(processor.parse(state.value))
  var change = debounce(onchangevalue, 4)
  var changeage = debounce(onchangeage, 4)
  var key = 0
  var unselected = true
  var options = templates.map((template, index) => {
    var selected = optionForTemplate(template) === state.template

    if (selected) {
      unselected = false
    }

    return h('option', {key: index, selected}, optionForTemplate(template))
  })

  setTimeout(resize, 4)

  return h('div', [
    h('section.highlight', [h('h1', {key: 'title'}, 'Readability')]),
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
        h(
          'a',
          {
            href: 'https://en.wikipedia.org/wiki/Dale–Chall_readability_formula'
          },
          'Dale–Chall'
        ),
        ', ',
        h(
          'a',
          {href: 'https://en.wikipedia.org/wiki/Automated_readability_index'},
          'Automated Readability'
        ),
        ', ',
        h(
          'a',
          {href: 'https://en.wikipedia.org/wiki/Coleman–Liau_index'},
          'Coleman–Liau'
        ),
        ', ',
        h(
          'a',
          {
            href:
              'https://en.wikipedia.org/wiki/Flesch–Kincaid_readability_tests#Flesch_reading_ease'
          },
          'Flesch'
        ),
        ', ',
        h(
          'a',
          {href: 'https://en.wikipedia.org/wiki/Gunning_fog_index'},
          'Gunning fog'
        ),
        ', ',
        h('a', {href: 'https://en.wikipedia.org/wiki/SMOG'}, 'SMOG'),
        ', and ',
        h(
          'a',
          {href: 'https://en.wikipedia.org/wiki/Spache_readability_formula'},
          'Spache'
        ),
        '.'
      ]),
      h('p', {key: 'ps'}, [
        'You can edit the text above, or pick a template: ',
        h(
          'select',
          {key: 'template', onchange: onchangetemplate},
          [
            unselected
              ? h('option', {key: '-1', selected: unselected}, '--')
              : null
          ].concat(options)
        ),
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
        h(
          'span',
          {
            title: 'Using the previous input updates the value reflected here'
          },
          String(state.age + 6)
        ),
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
        h(
          'a',
          {href: 'https://github.com/wooorm/readability'},
          'Fork this website'
        ),
        ' • ',
        h(
          'a',
          {href: 'https://github.com/wooorm/readability/blob/src/license'},
          'MIT'
        ),
        ' • ',
        h('a', {href: 'https://wooorm.com'}, '@wooorm')
      ])
    ])
  ])

  function all(node, parentIds) {
    var children = node.children
    var length = children.length
    var index = -1
    var results = []

    while (++index < length) {
      results = results.concat(one(children[index], parentIds.concat(index)))
    }

    return results
  }

  function one(node, parentIds) {
    var result = 'value' in node ? node.value : all(node, parentIds)
    var id = parentIds.join('-') + '-' + key
    var attrs = node.type === state.type ? highlight(node) : null

    if (attrs) {
      result = h('span', xtend({key: id, id}, attrs), result)
      key++
    }

    return result
  }

  // Trailing white-space in a `textarea` is shown, but not in a `div` with
  // `white-space: pre-wrap`.
  // Add a `br` to make the last newline explicit.
  function pad(nodes) {
    var tail = nodes[nodes.length - 1]

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}))
    }

    return nodes
  }
}

// Highlight a section.
function highlight(node) {
  var text = processor.stringify(node)
  var results = readabilityScores(text)
  var average
  var weight
  var hue
  average = averages[state.average]([
    gradeToAge(results.daleChall),
    gradeToAge(results.ari),
    gradeToAge(results.colemanLiau),
    gradeToAge(results.fleschKincaid),
    gradeToAge(results.smog),
    gradeToAge(results.gunningFog),
    // Spache is apparently best for children under age 8. If Spache returns a grade of 4 or higher, we should use Dale-Chall instead. readabilityScores has an opt-in config option to calculate it.
    gradeToAge(readabilityScores(text, {onlySpache: true}).spache)
  ])

  weight = unlerp(state.age, state.age + scale, average)
  hue = lerp(120, 0, min(1, max(0, weight)))

  return {
    style: {
      backgroundColor: 'hsla(' + [hue, '93%', '70%', 0.5].join(', ') + ')'
    }
  }
}

// Calculate the typical starting age (on the higher-end) when someone joins
// `grade` grade, in the US.
// See <https://en.wikipedia.org/wiki/Educational_stage#United_States>.
function gradeToAge(grade) {
  return age(round(grade + 5))
}

function age(value) {
  var max = 22
  return value > max ? max : value
}

function rows(node) {
  if (!node) {
    return
  }

  return (
    ceil(
      node.getBoundingClientRect().height /
        Number.parseInt(win.getComputedStyle(node).lineHeight, 10)
    ) + 1
  )
}

function optionForTemplate(template) {
  return template.dataset.label
}

function valueForTemplate(template) {
  return template.innerHTML + '\n\n— ' + optionForTemplate(template)
}

function resize() {
  dom.querySelector('textarea').rows = rows(dom.querySelector('.draw'))
}

function modeMean(value) {
  return mean(mode(value))
}
