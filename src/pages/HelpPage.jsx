import { useLang } from '../i18n.jsx';

const ABC_CHEATSHEET = `X:1                 номер / number
T:Назва             title (2nd T: = subtitle)
C:Автор             composer
G:Різдвяні          category / категорія
M:3/4               meter / розмір
L:1/4               unit note length / одиниця тривалості
Q:1/4=80            tempo / темп
K:G                 key / тональність (Am, F, Bb, Dm…)
D | G2 B/G/ | B2 A | G2 E | D2 D |
w: A-maz-ing_ grace how sweet the sound`;

function Uk() {
  return (
    <>
      <h2>Як користуватися</h2>
      <ul>
        <li><b>Бібліотека</b> — список пісень. Відкрийте пісню, натисніть <b>▶ Грати</b>.</li>
        <li>Торкніться будь-якої ноти — вона стане червоною, і відтворення почнеться з неї.</li>
        <li>Темп, тональність (транспонування), інструмент і окремі голоси налаштовуються під нотами.</li>
        <li><b>Пошук мелодії</b> — наберіть кілька нот на клавіатурі, і програма знайде пісні з такою ж мелодією (у будь-якій тональності).
          У пісні можна вибрати ноту й натиснути «Шукати цю мелодію».</li>
        <li><b>Редактор</b> — створення власних пісень. Вони зберігаються в цьому браузері («Мої пісні»).
          Не забувайте робити <b>Експорт .abc</b> як резервну копію.</li>
      </ul>

      <h2>Як записувати ноти</h2>
      <p>Пісні зберігаються у форматі <a href="https://abcnotation.com/learn" target="_blank" rel="noreferrer">ABC</a> — простий текстовий запис нот.
        Можна набирати мишкою (тривалість + клавіша фортепіано) або писати текстом:</p>
      <ul>
        <li><code>C D E F G A B</code> — перша октава, <code>c d e … b</code> — друга, <code>c'</code> — третя, <code>B,</code> — мала.</li>
        <li><code>^F</code> — дієз, <code>_B</code> — бемоль, <code>=F</code> — бекар.</li>
        <li>Тривалість відносно <code>L:</code>: <code>C2</code> — удвічі довша, <code>C/</code> — удвічі коротша, <code>C3/2</code> — з крапкою.</li>
        <li><code>z</code> — пауза, <code>|</code> — тактова риска, <code>|]</code> — кінець, <code>|: … :|</code> — повтор, <code>C-C</code> — ліга.</li>
        <li><code>[CEG]</code> — акорд. Багатоголосся: рядки <code>V:1</code>, <code>V:2</code>…</li>
        <li>Слова — рядок <code>w:</code> під нотами: склади через <code>-</code>, <code>_</code> — протягнути склад на ще одну ноту.</li>
      </ul>
      <pre className="code">{ABC_CHEATSHEET}</pre>

      <h2>Як перенести PDF або фото пісні</h2>
      <ol>
        <li><b>Вручну з оригіналом поруч.</b> У редакторі натисніть «Відкрити файл» і виберіть PDF чи фото —
          оригінал з’явиться поруч, і ноти можна переписати.</li>
        <li><b>Автоматичне розпізнавання (OMR).</b> Безкоштовна програма{' '}
          <a href="https://github.com/Audiveris/audiveris/releases" target="_blank" rel="noreferrer">Audiveris</a>{' '}
          розпізнає ноти з PDF і зберігає їх як MusicXML (.mxl). Відкрийте цей файл у редакторі — він перетвориться на ABC.
          Після розпізнавання завжди перевіряйте ноти по оригіналу. Так само можна імпортувати MusicXML з MuseScore, Sibelius, Finale.</li>
        <li><b>Через Claude.</b> Покладіть PDF у папку проєкту (<code>incoming/</code>) і попросіть Claude переписати їх у <code>src/songs</code>.</li>
      </ol>

      <h2>Як додати пісню до спільної бібліотеки</h2>
      <p>Пісні з «Мої пісні» бачите лише ви в цьому браузері. Щоб пісня з’явилася у всіх:
        зробіть <b>Експорт .abc</b>, покладіть файл у папку <code>src/songs/</code> репозиторію і надішліть зміни на GitHub —
        сайт оновиться автоматично за кілька хвилин.</p>
    </>
  );
}

function En() {
  return (
    <>
      <h2>How to use</h2>
      <ul>
        <li><b>Library</b> lists the songs. Open one and press <b>▶ Play</b>.</li>
        <li>Tap any note: it turns red and playback starts from it.</li>
        <li>Tempo, transposition, instrument and individual voices are set below the music.</li>
        <li><b>Melody search</b>: play a few notes on the keyboard and the app finds songs with that melody (in any key).
          In a song you can select a note and choose “Search this melody”.</li>
        <li><b>Editor</b>: create your own songs. They are stored in this browser (“My songs”).
          Use <b>Export .abc</b> for backups.</li>
      </ul>

      <h2>Writing notes</h2>
      <p>Songs are stored as <a href="https://abcnotation.com/learn" target="_blank" rel="noreferrer">ABC notation</a>, a simple text format.
        Enter notes with the mouse (duration + piano key) or type them:</p>
      <ul>
        <li><code>C D E F G A B</code> is the octave from middle C, <code>c d e … b</code> the one above, <code>c'</code> higher, <code>B,</code> lower.</li>
        <li><code>^F</code> sharp, <code>_B</code> flat, <code>=F</code> natural.</li>
        <li>Lengths are relative to <code>L:</code>: <code>C2</code> double, <code>C/</code> half, <code>C3/2</code> dotted.</li>
        <li><code>z</code> rest, <code>|</code> bar line, <code>|]</code> final bar, <code>|: … :|</code> repeat, <code>C-C</code> tie.</li>
        <li><code>[CEG]</code> chord. Several voices: <code>V:1</code>, <code>V:2</code>… lines.</li>
        <li>Lyrics go on a <code>w:</code> line below the notes: <code>-</code> between syllables, <code>_</code> holds a syllable over one more note.</li>
      </ul>
      <pre className="code">{ABC_CHEATSHEET}</pre>

      <h2>Bringing in PDFs or photos</h2>
      <ol>
        <li><b>Manually, with the original alongside.</b> In the editor press “Open file” and choose a PDF or image:
          it is shown next to the editor so you can copy the notes.</li>
        <li><b>Optical music recognition.</b> The free{' '}
          <a href="https://github.com/Audiveris/audiveris/releases" target="_blank" rel="noreferrer">Audiveris</a>{' '}
          app reads notes from a PDF and saves MusicXML (.mxl). Open that file in the editor and it is converted to ABC.
          Always proofread against the original. MusicXML from MuseScore, Sibelius or Finale works the same way.</li>
        <li><b>With Claude.</b> Put the PDFs in the project’s <code>incoming/</code> folder and ask Claude to transcribe them into <code>src/songs</code>.</li>
      </ol>

      <h2>Adding a song to the shared library</h2>
      <p>“My songs” are visible only in your browser. To publish a song for everyone: <b>Export .abc</b>, put the file in the
        repository’s <code>src/songs/</code> folder and push to GitHub; the site rebuilds automatically within a few minutes.</p>
    </>
  );
}

export default function HelpPage() {
  const { lang } = useLang();
  return <div className="page prose">{lang === 'uk' ? <Uk /> : <En />}</div>;
}
