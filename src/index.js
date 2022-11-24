/// <reference lib="dom" />
/* eslint-env browser */

/**
 * @typedef {import('virtual-dom').VNode} VNode
 * @typedef {import('virtual-dom').VProperties} VProperties
 * @typedef {import('nlcst').Parent} NlcstParent
 * @typedef {import('nlcst').Root} NlcstRoot
 * @typedef {import('nlcst').Content} NlcstContent
 * @typedef {NlcstRoot | NlcstContent} NlcstNode
 *
 * @typedef {'mean'|'median'|'mode'} Average
 *
 * @typedef State
 * @property {'SentenceNode'|'ParagraphNode'} type
 * @property {string|null} template
 * @property {string} value
 * @property {Average} average
 * @property {number} age
 */

import virtualDom from 'virtual-dom'
import debounce from 'debounce'
// @ts-expect-error: untyped.
import mean from 'compute-mean'
// @ts-expect-error: untyped.
import median from 'compute-median'
// @ts-expect-error: untyped.
import unlerp from 'unlerp'
// @ts-expect-error: untyped.
import lerp from 'lerp'
import {unified} from 'unified'
import retextEnglish from 'retext-english'
import retextStringify from 'retext-stringify'
import readabilityScores from 'readability-scores'

const {create, h, diff, patch} = virtualDom

/** @type {Record<Average, (value: Array<number>) => number>} */
const averages = {
  mean,
  median,
  mode: modeMean
}

/** @type {Record<string, State['type']>} */
const types = {
  sentence: 'SentenceNode',
  paragraph: 'ParagraphNode'
}

const minAge = 5
const maxAge = 22
const defaultAge = 12
const scale = 6

const max = Math.max
const min = Math.min
const round = Math.round
const ceil = Math.ceil

// Mode Copyright (c) 2014. Athan Reines.
// copied from \node_modules\compute-mode\lib\index.js, plus bug fix
/**
 * @param {Array<number>} array
 * @returns {Array<number>}
 */
function mode(array) {
  if (!Array.isArray(array)) {
    throw new TypeError(
      'mode()::invalid input argument. Must provide an array.'
    )
  }

  const length = array.length
  /** @type {Record<number, number>} */
  const count = {}
  let max = 0
  /** @type {Array<number>} */
  let vals = []

  for (let i = 0; i < length; i++) {
    const value = array[i]
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

  // ```
  // return vals.sort(function sort(a, b) {
  //  return a - b
  // })
  // ```
  return vals
} // End FUNCTION mode()

const processor = unified().use(retextEnglish).use(retextStringify)
const main = document.querySelectorAll('main')[0]
const templates = Array.from(document.querySelectorAll('template'))

/** @type {State} */
const state = {
  type: 'SentenceNode',
  average: 'median',
  template: optionForTemplate(templates[0]),
  value: valueForTemplate(templates[0]),
  age: defaultAge
}

let tree = render(state)
let dom = main.appendChild(create(tree))

/**
 * @param {KeyboardEvent|MouseEvent|ClipboardEvent} ev
 */
function onchangevalue(ev) {
  if (
    ev &&
    ev.target &&
    'value' in ev.target &&
    typeof ev.target.value === 'string'
  ) {
    const previous = state.value
    const next = ev.target.value

    if (previous !== next) {
      state.value = next
      state.template = null
      onchange()
    }
  }
}

/**
 * @param {Event} ev
 */
function onchangeaverage(ev) {
  if (
    ev &&
    ev.target &&
    'value' in ev.target &&
    typeof ev.target.value === 'string'
  ) {
    state.average = /** @type {Average} */ (ev.target.value.toLowerCase())
    onchange()
  }
}

/**
 * @param {Event} ev
 */
function onchangetype(ev) {
  if (ev && ev.target && ev.target instanceof HTMLSelectElement) {
    state.type = types[ev.target.value.toLowerCase()]
    onchange()
  }
}

/**
 * @param {Event} ev
 */
function onchangetemplate(ev) {
  if (ev && ev.target && ev.target instanceof HTMLSelectElement) {
    const target = ev.target.selectedOptions[0]
    const node = document.querySelector(
      '[data-label="' + target.textContent + '"]'
    )
    if (node && node instanceof HTMLTemplateElement) {
      state.template = optionForTemplate(node)
      state.value = valueForTemplate(node)
      onchange()
    }
  }
}

/**
 * @param {Event} ev
 */
function onchangeage(ev) {
  if (
    ev &&
    ev.target &&
    'value' in ev.target &&
    typeof ev.target.value === 'string'
  ) {
    state.age = Number(ev.target.value)
    onchange()
  }
}

function onchange() {
  const next = render(state)
  dom = patch(dom, diff(tree, next))
  tree = next
}

/**
 * @param {State} state
 * @returns {VNode}
 */
function render(state) {
  const tree = processor.runSync(processor.parse(state.value))
  const change = debounce(onchangevalue, 4)
  const changeage = debounce(onchangeage, 4)
  let key = 0
  let unselected = true
  const options = templates.map((template, index) => {
    const selected = optionForTemplate(template) === state.template

    if (selected) {
      unselected = false
    }

    return h(
      'option',
      {key: String(index), selected},
      optionForTemplate(template)
    )
  })

  setTimeout(resize, 4)

  return h('div', [
    h('section.highlight', [h('h1', {key: 'title'}, 'Readability')]),
    h('div', {key: 'editor', className: 'editor'}, [
      h('div', {key: 'draw', className: 'draw'}, pad(all(tree, []))),
      h(
        'textarea',
        {
          key: 'area',
          value: state.value,
          oninput: change,
          onpaste: change,
          onkeyup: change,
          onmouseup: change
        },
        []
      )
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
            href: 'https://en.wikipedia.org/wiki/Flesch–Kincaid_readability_tests#Flesch_reading_ease'
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
        h('select', {key: 'template', onchange: onchangetemplate}, [
          unselected
            ? h('option', {key: '-1', selected: unselected}, '--')
            : '',
          ...options
        ]),
        '.'
      ]),
      h('p', {key: '2'}, [
        'You can choose which target age you want to reach (now at ',
        h(
          'input',
          {
            type: 'number',
            min: minAge,
            max: maxAge,
            oninput: changeage,
            onpaste: changeage,
            onkeyup: changeage,
            onmouseup: changeage,
            attributes: {
              value: String(defaultAge)
            }
          },
          []
        ),
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
      h('p', {key: '3'}, [
        'You can pick which average to use (currently ',
        h('select', {key: 'average', onchange: onchangeaverage}, [
          h('option', {key: '0'}, 'mean'),
          h('option', {key: '1', selected: true}, 'median'),
          h('option', {key: '2'}, 'mode')
        ]),
        ').'
      ]),
      h('p', {key: '4'}, [
        'It’s now highlighting per ',
        h('select', {key: 'type', onchange: onchangetype}, [
          h('option', {key: '0'}, 'paragraph'),
          h('option', {key: '1', selected: true}, 'sentence')
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

  /**
   * @param {NlcstParent} node
   * @param {Array<number>} parentIds
   * @returns {Array<VNode|string>}
   */
  function all(node, parentIds) {
    const children = node.children
    const length = children.length
    let index = -1
    /** @type {Array<VNode|string>} */
    const results = []

    while (++index < length) {
      const ids = [...parentIds, index]
      const result = one(children[index], ids)

      if (Array.isArray(result)) {
        results.push(...result)
      } else {
        results.push(result)
      }
    }

    return results
  }

  /**
   * @param {NlcstNode} node
   * @param {Array<number>} parentIds
   * @returns {string|VNode|Array<VNode|string>}
   */
  function one(node, parentIds) {
    /** @type {string|VNode|Array<VNode|string>} */
    let result = 'value' in node ? node.value : all(node, parentIds)
    const id = parentIds.join('-') + '-' + key
    const attrs = node.type === state.type ? highlight(node) : null

    if (attrs) {
      result = h('span', {key: id, id, ...attrs}, result)
      key++
    }

    return result
  }

  /**
   * Trailing white-space in a `textarea` is shown, but not in a `div` with
   * `white-space: pre-wrap`.
   * Add a `br` to make the last newline explicit.
   *
   * @param {Array<VNode|string>} nodes
   * @returns {Array<VNode|string>}
   */
  function pad(nodes) {
    const tail = nodes[nodes.length - 1]

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}, []))
    }

    return nodes
  }
}

/**
 * @param {NlcstNode} node
 * @returns {VProperties|void}
 */
function highlight(node) {
  // @ts-expect-error: fine.
  const text = processor.stringify(node)
  const results = readabilityScores(text)
  // Spache is apparently best for children under age 8. If Spache returns a grade of 4 or higher, we should use Dale-Chall instead. readabilityScores has an opt-in config option to calculate it.
  const spache = readabilityScores(text, {onlySpache: true}).spache
  const average = averages[state.average]([
    // @ts-expect-error: types.
    gradeToAge(results.daleChall),
    // @ts-expect-error: types.
    gradeToAge(results.ari),
    // @ts-expect-error: types.
    gradeToAge(results.colemanLiau),
    // @ts-expect-error: types.
    gradeToAge(results.fleschKincaid),
    // @ts-expect-error: types.
    gradeToAge(results.smog),
    // @ts-expect-error: types.
    gradeToAge(results.gunningFog),
    // @ts-expect-error: types.
    gradeToAge(spache)
  ])

  const weight = unlerp(state.age, state.age + scale, average)
  const hue = lerp(120, 0, min(1, max(0, weight)))

  return {
    style: {
      backgroundColor: 'hsla(' + [hue, '93%', '70%', 0.5].join(', ') + ')'
    }
  }
}

/**
 * Calculate the typical starting age (on the higher-end) when someone joins
 * `grade` grade, in the US.
 * See <https://en.wikipedia.org/wiki/Educational_stage#United_States>.
 *
 * @param {number} grade
 * @returns {number}
 */
function gradeToAge(grade) {
  return age(round(grade + 5))
}

/**
 * @param {number} value
 * @returns {number}
 */
function age(value) {
  const max = 22
  return value > max ? max : value
}

/**
 * @param {Element|null} node
 * @returns {number|void}
 */
function rows(node) {
  if (!node) {
    return
  }

  return (
    ceil(
      node.getBoundingClientRect().height /
        Number.parseInt(window.getComputedStyle(node).lineHeight, 10)
    ) + 1
  )
}

/**
 * @param {HTMLTemplateElement} template
 * @returns {string}
 */
function optionForTemplate(template) {
  const label = template.dataset.label
  if (!label) throw new Error('Expected `data-label` on `<template>`')
  return label
}

/**
 * @param {HTMLTemplateElement} template
 * @returns {string}
 */
function valueForTemplate(template) {
  return template.innerHTML + '\n\n— ' + optionForTemplate(template)
}

function resize() {
  const textarea = dom.querySelector('textarea')
  const draw = dom.querySelector('.draw')
  if (!textarea) throw new Error('Expected `textarea` `dom`')
  if (!draw) throw new Error('Expected `.draw` in `dom`')
  const result = rows(draw)
  if (result !== undefined) textarea.rows = result
}

/**
 * @param {Array<number>} value
 * @returns {number}
 */
function modeMean(value) {
  return mean(mode(value))
}
