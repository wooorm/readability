/* eslint-env browser */

/// <reference lib="dom" />

/**
 * @import {Nodes, Paragraph, Parents, Sentence} from 'nlcst'
 */

import {automatedReadability} from 'automated-readability'
import {colemanLiau} from 'coleman-liau'
import {mean, median, mode} from 'd3-array'
import {daleChallFormula, daleChallGradeLevel} from 'dale-chall-formula'
import {daleChall} from 'dale-chall'
import {flesch} from 'flesch'
import {gunningFog} from 'gunning-fog'
// @ts-expect-error: untyped.
import lerp from 'lerp'
import {toString} from 'nlcst-to-string'
import {ParseEnglish} from 'parse-english'
import ReactDom from 'react-dom/client'
import React from 'react'
import {smogFormula} from 'smog-formula'
import {spacheFormula} from 'spache-formula'
import {spache} from 'spache'
import {syllable} from 'syllable'
import {SKIP, visit} from 'unist-util-visit'
// @ts-expect-error: untyped.
import unlerp from 'unlerp'

const $main = /** @type {HTMLElement} */ (document.querySelector('main'))
const defaultAge = 12
const maxAge = 22
const minAge = 5
/** @type {Record<string, string>} */
const samples = {
  'Readability: Definition, Wikipedia': `People have defined readability in various ways, e.g., in: The Literacy Dictionary, Jeanne Chall and Edgar Dale, G. Harry McLaughlin, William DuBay.

Easy reading helps learning and enjoyment, so what we write should be easy to understand.

While many writers and speakers since ancient times have used plain language, the 20th century brought more focus to reading ease. Much research has focused on matching prose to reading skills. This has used many successful formulas: in research, government, teaching, publishing, the military, medicine, and business. Many people in many languages have been helped by this.

By the year 2000, there were over 1,000 studies on readability formulas in professional journals about their validity and merit. The study of reading is not just in teaching. Research has shown that much money is wasted by companies in making texts hard for the average reader to read.

There are summaries of this research; see the links in this section. Many textbooks on reading include pointers to readability.`,
  'Ernest Hemingway, The Sun Also Rises': `Finally, after a couple more false klaxons, the bus started, and Robert Cohn waved good-by to us, and all the Basques waved good-by to him. As soon as we started out on the road outside of town it was cool. It felt nice riding high up and close under the trees. The bus went quite fast and made a good breeze, and as we went out along the road with the dust powdering the trees and down the hill, we had a fine view, back through the trees, of the town rising up from the bluff above the river. The Basque lying against my knees pointed out the view with the neck of a wine-bottle, and winked at us. He nodded his head.`,
  'Dr Seuss, The Cat in the Hat': `Then our mother came in
And she said to us two,
“Did you have any fun?
Tell me. What did you do?”

And Sally and I did not
know what to say.
Should we tell her
The things that went on
there that day?

Well… what would YOU do
If your mother asked you?

The Cat in the Hat
Look at me!
Look at me!
Look at me NOW!
It is fun to have fun
But you have
to know how.`,
  'Trump, Presidential Bid announcement': `Thank you. It’s true, and these are the best and the finest. When Mexico sends its people, they’re not sending their best. They’re not sending you. They’re not sending you. They’re sending people that have lots of problems, and they’re bringing those problems with us. They’re bringing drugs. They’re bringing crime. They’re rapists. And some, I assume, are good people.

  But I speak to border guards and they tell us what we’re getting. And it only makes common sense. It only makes common sense. They’re sending us not the right people.`,
  'Obama, Farewell Speech': `On Tuesday, January 10, I’ll go home to Chicago to say my grateful farewell to you, even if you can’t be there in person.

  I’m just beginning to write my remarks. But I’m thinking about them as a chance to say thank you for this amazing journey, to celebrate the ways you’ve changed this country for the better these past eight years, and to offer some thoughts on where we all go from here.
  Since 2009, we’ve faced our fair share of challenges, and come through them stronger. That’s because we have never let go of a belief that has guided us ever since our founding — our conviction that, together, we can change this country for the better. So I hope you’ll join me one last time.`
}
const scale = 6

const parser = new ParseEnglish()

const root = ReactDom.createRoot($main)

root.render(React.createElement(Playground))

function Playground() {
  const sampleNames = Object.keys(samples)
  const [age, setAge] = React.useState(defaultAge)
  const [average, setAverage] = React.useState('median')
  const [paragraph, setParagraph] = React.useState(false)
  const [sample, setSample] = React.useState(sampleNames[0])
  const [text, setText] = React.useState(textFromSample(sample))
  const tree = parser.parse(text)
  let unselected = true
  /** @type {Array<JSX.Element>} */
  const options = []

  for (const sampleName of sampleNames) {
    const selected = textFromSample(sampleName) === text

    if (selected) unselected = false

    options.push(
      <option key={sampleName} selected={selected}>
        {sampleName}
      </option>
    )
  }

  return (
    <div>
      <section className="highlight">
        <h1>
          <code>readability</code>
        </h1>
      </section>
      <div className="editor">
        <div className="draw">
          {all(tree)}
          {/* Trailing whitespace in a `textarea` is shown,
          but not in a `div` with `white-space: pre-wrap`;
          add a `br` to make the last newline explicit. */}
          {/\n[ \t]*$/.test(text) ? <br /> : undefined}
        </div>
        <textarea
          className="write"
          onChange={(event) => setText(event.target.value)}
          rows={text.split('\n').length + 1}
          spellCheck="false"
          value={text}
        />
      </div>
      <section className="highlight">
        <p>
          This project measures readability in text with several formulas:{' '}
          <a href="https://en.wikipedia.org/wiki/Dale–Chall_readability_formula">
            Dale–Chall
          </a>
          ,{' '}
          <a href="https://en.wikipedia.org/wiki/Automated_readability_index">
            Automated Readability
          </a>
          ,{' '}
          <a href="https://en.wikipedia.org/wiki/Coleman–Liau_index">
            Coleman–Liau
          </a>
          ,{' '}
          <a href="https://en.wikipedia.org/wiki/Flesch–Kincaid_readability_tests#Flesch_reading_ease">
            Flesch
          </a>
          ,{' '}
          <a href="https://en.wikipedia.org/wiki/Gunning_fog_index">
            Gunning fog
          </a>
          , <a href="https://en.wikipedia.org/wiki/SMOG">SMOG</a>, and{' '}
          <a href="https://en.wikipedia.org/wiki/Spache_readability_formula">
            Spache
          </a>
          .
        </p>
        <p>
          You can edit the text above, or pick a template:{' '}
          <select
            onChange={function (event) {
              setSample(event.target.value)
              setText(textFromSample(event.target.value))
            }}
          >
            {unselected ? (
              <option disabled selected={true}>
                --
              </option>
            ) : undefined}
            {options}
          </select>
          .
        </p>
        <p>
          You can choose which target age you want to reach (now at{' '}
          <input
            type="number"
            min={minAge}
            max={maxAge}
            onChange={function (event) {
              setAge(Number(event.target.value))
            }}
            value={age}
          />
          ), and text will be highlighted in green if the text matches that
          (albeit if they’re still in school). Red means it would take 6 years
          longer in school (so an age of{' '}
          <span title="Using the previous input updates the value reflected here">
            {age + 6}
          </span>
          ), and the years between them mix gradually between green and red.
        </p>
        <p>
          You can pick which average to use (currently{' '}
          <select
            onChange={function (event) {
              setAverage(event.target.value)
            }}
          >
            <option selected={average === 'mean'}>mean</option>
            <option selected={average === 'median'}>median</option>
            <option selected={average === 'mode'}>mode</option>
          </select>
          ).
        </p>
        <p>
          It’s now highlighting per
          <select
            onChange={function (event) {
              setParagraph(event.target.value === 'paragraph')
            }}
          >
            <option selected={paragraph}>paragraph</option>
            <option selected={!paragraph}>sentence</option>
          </select>
          , but you can change that.
        </p>
      </section>
      <section className="credits">
        <p>
          <a href="https://github.com/wooorm/readability">Fork this website</a>{' '}
          •{' '}
          <a href="https://github.com/wooorm/readability/blob/main/license">
            MIT
          </a>{' '}
          • <a href="https://github.com/wooorm">@wooorm</a>
        </p>
      </section>
    </div>
  )

  /**
   * @param {Parents} parent
   * @returns {Array<JSX.Element | string>}
   */
  function all(parent) {
    /** @type {Array<JSX.Element | string>} */
    const results = []

    for (const child of parent.children) {
      const result = one(child)
      if (Array.isArray(result)) {
        results.push(...result)
      } else {
        results.push(result)
      }
    }

    return results
  }

  /**
   * @param {Nodes} node
   * @returns {Array<JSX.Element | string> | JSX.Element | string}
   */
  function one(node) {
    const result = 'value' in node ? node.value : all(node)

    if (node.type === (paragraph ? 'ParagraphNode' : 'SentenceNode')) {
      return <span {...highlight(node)}>{result}</span>
    }

    return result
  }

  /**
   * @param {Paragraph | Sentence} node
   * @returns {React.HTMLAttributes<HTMLSpanElement> | undefined}
   */
  function highlight(node) {
    // Note: this code is like `retextjs/readability`.
    /** @type {Set<string>} */
    const familiarWords = new Set()
    /** @type {Set<string>} */
    const easyWord = new Set()
    let complexPolysillabicWord = 0
    let easyWordCount = 0
    let familiarWordCount = 0
    let letters = 0
    let polysillabicWord = 0
    let totalSyllables = 0
    let wordCount = 0

    visit(node, 'WordNode', function (node) {
      const value = toString(node)
      const caseless = value.toLowerCase()
      const syllables = syllable(value)

      wordCount++
      totalSyllables += syllables
      letters += value.length

      // Count complex words for gunning-fog based on whether they have three
      // or more syllables and whether they aren’t proper nouns.  The last is
      // checked a little simple, so this index might be over-eager.
      if (syllables >= 3) {
        polysillabicWord++

        if (value.charCodeAt(0) === caseless.charCodeAt(0)) {
          complexPolysillabicWord++
        }
      }

      // Find unique unfamiliar words for spache.
      if (spache.includes(caseless) && !familiarWords.has(caseless)) {
        familiarWords.add(caseless)
        familiarWordCount++
      }

      // Find unique difficult words for dale-chall.
      if (daleChall.includes(caseless) && !easyWord.has(caseless)) {
        easyWord.add(caseless)
        easyWordCount++
      }

      // No need to walk into words.
      return SKIP
    })

    const counts = {
      character: letters,
      complexPolysillabicWord,
      difficultWord: wordCount - easyWordCount,
      letter: letters,
      polysillabicWord,
      sentence: 1,
      syllable: totalSyllables,
      unfamiliarWord: wordCount - familiarWordCount,
      word: wordCount
    }

    const scores = [
      gradeToAge(automatedReadability(counts)),
      gradeToAge(colemanLiau(counts)),
      gradeToAge(daleChallGradeLevel(daleChallFormula(counts))[1]),
      fleschToAge(flesch(counts)),
      gradeToAge(gunningFog(counts)),
      smogToAge(smogFormula(counts)),
      gradeToAge(spacheFormula(counts))
    ]

    // Clamp scores to the minimum and maximum age.
    let index = -1
    while (++index < scores.length) {
      scores[index] = Math.min(maxAge, Math.max(minAge, scores[index]))
    }

    const score =
      average === 'mean'
        ? mean(scores)
        : average === 'median'
          ? median(scores)
          : mode(scores)
    const weight = unlerp(age, age + scale, score)
    const hue = lerp(120, 0, Math.min(1, Math.max(0, weight)))

    return {style: {backgroundColor: 'hsl(' + hue + 'deg 93% 70% / 50%)'}}
  }
}

/**
 * @param {string} sampleName
 * @returns {string}
 */
function textFromSample(sampleName) {
  return samples[sampleName] + '\n\n— ' + sampleName
}

/**
 * Calculate the typical starting age (on the higher-end) when someone joins
 * `grade` grade, in the US.
 * See: <https://en.wikipedia.org/wiki/Educational_stage#United_States>
 *
 * @param {number} grade
 *   Grade.
 * @returns {number}
 *   Age.
 */
function gradeToAge(grade) {
  return Math.round(grade + 5)
}

/**
 * Calculate the age relating to a Flesch result.
 *
 * @param {number} value
 *   Flesch score.
 * @returns {number}
 *   Age.
 */
function fleschToAge(value) {
  return 20 - Math.floor(value / 10)
}

/**
 * Calculate the age relating to a SMOG result.
 * See: <http://www.readabilityformulas.com/smog-readability-formula.php>
 *
 * @param {number} value
 *   SMOG score.
 * @returns {number}
 *   Age.
 */
function smogToAge(value) {
  return Math.ceil(Math.sqrt(value) + 2.5)
}
