// Interface texts, Russian and English. `t(key, vars)` falls back to English, then to the key.

const RU = {
  'idle.sub': 'Нажми ▶ — прочитаю последний ответ',
  'done.sub': 'Дочитано',
  'err.empty': 'Здесь нечего читать',
  'err.silent': 'Голос молчит — проверь голоса в настройках',
  'err.novoice': 'В этом браузере нет голосов',
  'act.play': 'Читать', 'act.pause': 'Пауза', 'act.prev': 'Предыдущая фраза', 'act.next': 'Следующая фраза',
  'act.speed': 'Скорость', 'act.who': 'Кого читать', 'act.settings': 'Настройки', 'act.close': 'Закрыть',
  'act.expand': 'Развернуть', 'act.collapse': 'Свернуть', 'act.open': 'Плеер', 'act.mes': 'Читать вслух', 'act.volume': 'Громкость',
  'act.progress': 'Место в ответе', 'act.move': 'Перетащи, чтобы переставить',
  'who.all': 'Читаю всё', 'who.speech': 'Только реплики',
  'menu.show': 'Sable Voice — показать плеер', 'menu.hide': 'Sable Voice — спрятать плеер',

  'set.title': 'Sable Voice',
  'set.enabled': 'Плеер включён',
  'set.language': 'Язык меню', 'lang.auto': 'Как в таверне', 'lang.ru': 'Русский', 'lang.en': 'English',

  'g.player': 'Плеер', 'g.read': 'Что читать', 'g.voices': 'Голоса', 'g.skip': 'Что не читать', 'g.look': 'Внешний вид', 'g.danger': 'Опасная зона',

  'view': 'Вид', 'view.float': 'Плавающая кнопка', 'view.bar-top': 'Полоска сверху', 'view.bar-bottom': 'Полоска снизу',
  'view.side-left': 'Мини-панель слева', 'view.side-right': 'Мини-панель справа',
  'cardMode': 'Карточка', 'cardMode.compact': 'Маленькая', 'cardMode.full': 'Большая, с обложкой',
  'autoplay': 'Читать новый ответ сразу', 'autoplay.hint': 'Как только ответ дописан',
  'chain': 'Не останавливаться', 'chain.hint': 'После ответа читать следующий',
  'mesButton': 'Кнопка ▶ у каждого сообщения',
  'tapJump': 'Тап по тексту — читать отсюда', 'tapJump.hint': 'Работает, пока плеер читает или стоит на паузе',
  'highlight': 'Подсвечивать фразу', 'follow': 'Листать чат за голосом',

  'read.narration': 'Нарратор — текст вне кавычек', 'read.speech': 'Реплики — текст в кавычках', 'read.thoughts': 'Мысли — курсив',
  'read.user': 'Мои сообщения тоже',
  'asterisk': 'Курсив и *звёздочки* — это', 'asterisk.thought': 'Мысли персонажа', 'asterisk.narration': 'Действия (читает нарратор)',

  'err.nokey': 'Нет ключа — впиши его в «Ключи»', 'err.key': 'Ключ не подошёл', 'err.credits': 'Баланс сервиса пуст',
  'err.busy': 'Сервис занят или лимит — попробуй чуть позже', 'err.net': 'Нет связи с сервисом', 'err.nourl': 'Не указан адрес сервера',
  'err.nomodel': 'Не выбрана модель', 'err.novoiceid': 'Не выбран голос', 'err.noaudio': 'Сервис не прислал звук',
  'err.nosource': 'Неизвестный источник голоса', 'err.audio': 'Этот звук не проигрывается', 'err.blocked': 'Браузер не дал включить звук — нажми ▶ ещё раз',
  'keys.title': 'Ключи', 'keys.openrouter': 'Ключ OpenRouter', 'keys.google': 'Ключ Google AI Studio', 'keys.eleven': 'Ключ ElevenLabs',
  'keys.openai.url': 'Свой адрес 1 (как у OpenAI)', 'keys.openai': 'Ключ для адреса 1',
  'keys.openai2.url': 'Свой адрес 2 (как у OpenAI)', 'keys.openai2': 'Ключ для адреса 2',
  'keys.hint': 'Ключи лежат в настройках этой таверны и уходят только в свой сервис.',
  'source.device': 'Это устройство (бесплатно)', 'source.openrouter': 'OpenRouter', 'voice.pick': '— выбери модель —', 'source.openai': 'Свой адрес 1', 'source.openai2': 'Свой адрес 2',
  'source.google': 'Google Gemini', 'source.eleven': 'ElevenLabs',
  'voice.source': 'Откуда голос', 'voice.model': 'Модель', 'voice.voice': 'Голос', 'voice.style': 'Каким должен быть голос',
  'voice.style.hint': 'Пара фраз по-английски. Не все модели это слушают.', 'voice.free': 'бесплатно', 'voice.default': 'Голос по умолчанию',
  'voice.wait': 'Готовлю звук…', 'hint.describe': 'У этой модели нет списка голосов — опиши голос ниже.',
  'hint.eleven': 'Впиши ключ, чтобы увидеть свои голоса, или вставь ID голоса.',
  'voice.narrator': 'Нарратор', 'voice.character': 'Персонаж', 'voice.own': 'Свой голос для: {name}', 'voice.own.none': 'Открой чат с персонажем',
  'voice.auto': 'Авто — по языку текста', 'voice.same': 'Как у всех персонажей',
  'voice.suggest': 'Подобрать по карточке', 'voice.suggest.hint': 'Модель таверны прочитает карточку и опишет голос. Один короткий запрос.',
  'voice.suggest.wait': 'Читаю карточку…', 'voice.suggest.done': 'Описание готово — нажми «Послушать»', 'voice.suggest.fail': 'Не получилось — модель таверны не ответила',
  'voice.suggest.device': 'Описание записано, но голоса устройства его не слушают — выбери интернет-источник',
  'voice.rate': 'Темп', 'voice.pitch': 'Высота', 'voice.test': 'Послушать',
  'voice.thoughts': 'Мысли читает', 'voice.thoughts.character': 'Голос персонажа', 'voice.thoughts.narrator': 'Голос нарратора',
  'voice.none': 'Голосов не нашлось. На телефоне: Настройки → Синтез речи.',
  'voice.other': 'Другие языки', 'voice.missing': 'нет на этом устройстве',
  'unit.ms': 'мс', 'unit.chars': 'зн.',
  'speed': 'Общая скорость', 'volume': 'Громкость', 'pauseMs': 'Пауза между абзацами', 'chunkChars': 'Длина фразы',
  'chunkChars.hint': 'Короче — быстрее старт и точнее подсветка',
  'sample.narrator': 'Он обернулся и долго молчал, глядя в окно.', 'sample.character': 'Ты опоздала. Я уже начал волноваться.',

  'skip.ooc': 'OOC-заметки', 'skip.footer': 'Трекер в конце ответа', 'skip.footer.hint': 'Строки со значками после последней черты',
  'skip.code': 'Код и блоки с кодом', 'skip.links': 'Ссылки',
  'skip.tags': 'Теги, которые не читать', 'skip.tags.hint': 'Через запятую. Всё внутри тега пропускается.',
  'skip.selectors': 'Блоки страницы (CSS)', 'skip.selectors.hint': 'Для своих вставок: .my-tracker, .panel',
  'skip.regex': 'Свои шаблоны', 'skip.regex.hint': 'По одному на строку. Что совпало — не читается.',

  'look.presets': 'Готовые цвета', 'look.accent': 'Главный цвет', 'look.base': 'Фон плеера', 'look.text': 'Текст', 'look.mark': 'Подсветка фразы',
  'look.auto': 'авто', 'look.opacity': 'Плотность фона', 'look.blur': 'Размытие', 'look.radius': 'Скругление', 'look.fontSize': 'Размер шрифта',
  'look.scale': 'Размер плеера', 'look.cover': 'Обложка', 'cover.avatar': 'Аватар персонажа', 'cover.disc': 'Пластинка', 'cover.none': 'Без обложки',
  'look.spin': 'Крутить обложку при чтении',
  'look.bg': 'Картинка на фон', 'look.bg.file': 'Выбрать файл', 'look.bg.link': 'или ссылка на картинку', 'look.bg.remove': 'Убрать',
  'look.bg.big': 'Картинка слишком большая, возьми поменьше', 'look.bg.bad': 'Это не картинка',
  'look.bgDim': 'Затемнение картинки', 'look.bgFit': 'Как класть', 'bgFit.cover': 'Заполнить', 'bgFit.contain': 'Целиком', 'bgFit.tile': 'Плиткой',
  'look.export': 'Сохранить вид в файл', 'look.import': 'Загрузить вид', 'look.import.bad': 'Не получилось прочитать файл',

  'danger.note': 'Здесь всё сбрасывается сразу. Вернуть нельзя.',
  'danger.look': 'Сбросить внешний вид', 'danger.pos': 'Вернуть плеер на место', 'danger.voices': 'Забыть голоса персонажей',
  'danger.all': 'Сбросить все настройки', 'danger.sure': 'Точно? Нажми ещё раз', 'danger.done': 'Готово',
  'debug': 'Писать журнал в консоль',
};

const EN = {
  'idle.sub': 'Press ▶ and I read the last reply',
  'done.sub': 'Finished',
  'err.empty': 'Nothing to read here',
  'err.silent': 'The voice is silent — check the voices in settings',
  'err.novoice': 'This browser has no voices',
  'act.play': 'Read', 'act.pause': 'Pause', 'act.prev': 'Previous phrase', 'act.next': 'Next phrase',
  'act.speed': 'Speed', 'act.who': 'What to read', 'act.settings': 'Settings', 'act.close': 'Close',
  'act.expand': 'Expand', 'act.collapse': 'Collapse', 'act.open': 'Player', 'act.mes': 'Read aloud', 'act.volume': 'Volume',
  'act.progress': 'Place in the reply', 'act.move': 'Drag to move',
  'who.all': 'Reading everything', 'who.speech': 'Dialogue only',
  'menu.show': 'Sable Voice — show the player', 'menu.hide': 'Sable Voice — hide the player',

  'set.title': 'Sable Voice',
  'set.enabled': 'Player on',
  'set.language': 'Menu language', 'lang.auto': 'Same as the tavern', 'lang.ru': 'Русский', 'lang.en': 'English',

  'g.player': 'Player', 'g.read': 'What to read', 'g.voices': 'Voices', 'g.skip': 'What to skip', 'g.look': 'Look', 'g.danger': 'Danger zone',

  'view': 'View', 'view.float': 'Floating button', 'view.bar-top': 'Bar at the top', 'view.bar-bottom': 'Bar at the bottom',
  'view.side-left': 'Mini panel, left', 'view.side-right': 'Mini panel, right',
  'cardMode': 'Card', 'cardMode.compact': 'Small', 'cardMode.full': 'Large, with a cover',
  'autoplay': 'Read a new reply at once', 'autoplay.hint': 'As soon as the reply is finished',
  'chain': 'Keep reading', 'chain.hint': 'Go on to the next message after a reply',
  'mesButton': '▶ button on every message',
  'tapJump': 'Tap the text to read from there', 'tapJump.hint': 'Works while the player is reading or paused',
  'highlight': 'Highlight the phrase', 'follow': 'Scroll the chat with the voice',

  'read.narration': 'Narrator — text outside quotes', 'read.speech': 'Dialogue — text in quotes', 'read.thoughts': 'Thoughts — italics',
  'read.user': 'My messages too',
  'asterisk': 'Italics and *asterisks* are', 'asterisk.thought': 'The character\'s thoughts', 'asterisk.narration': 'Actions (the narrator reads them)',

  'err.nokey': 'No key — add it under “Keys”', 'err.key': 'The key was not accepted', 'err.credits': 'The service balance is empty',
  'err.busy': 'The service is busy or limited — try a bit later', 'err.net': 'No connection to the service', 'err.nourl': 'No server address',
  'err.nomodel': 'No model chosen', 'err.novoiceid': 'No voice chosen', 'err.noaudio': 'The service sent no sound',
  'err.nosource': 'Unknown voice source', 'err.audio': 'This sound cannot be played', 'err.blocked': 'The browser blocked the sound — press ▶ again',
  'keys.title': 'Keys', 'keys.openrouter': 'OpenRouter key', 'keys.google': 'Google AI Studio key', 'keys.eleven': 'ElevenLabs key',
  'keys.openai.url': 'Own address 1 (OpenAI-shaped)', 'keys.openai': 'Key for address 1',
  'keys.openai2.url': 'Own address 2 (OpenAI-shaped)', 'keys.openai2': 'Key for address 2',
  'keys.hint': 'Keys live in the settings of this tavern and go only to their own service.',
  'source.device': 'This device (free)', 'source.openrouter': 'OpenRouter', 'voice.pick': '— choose a model —', 'source.openai': 'Own address 1', 'source.openai2': 'Own address 2',
  'source.google': 'Google Gemini', 'source.eleven': 'ElevenLabs',
  'voice.source': 'Voice from', 'voice.model': 'Model', 'voice.voice': 'Voice', 'voice.style': 'How the voice should sound',
  'voice.style.hint': 'A couple of phrases in English. Not every model listens to it.', 'voice.free': 'free', 'voice.default': 'Default voice',
  'voice.wait': 'Preparing the sound…', 'hint.describe': 'This model has no voice list — describe the voice below.',
  'hint.eleven': 'Add the key to see your voices, or paste a voice ID.',
  'voice.narrator': 'Narrator', 'voice.character': 'Character', 'voice.own': 'Own voice for: {name}', 'voice.own.none': 'Open a chat with a character',
  'voice.auto': 'Auto — by the text language', 'voice.same': 'Same as all characters',
  'voice.suggest': 'Suggest from the card', 'voice.suggest.hint': 'The tavern model reads the card and describes the voice. One short request.',
  'voice.suggest.wait': 'Reading the card…', 'voice.suggest.done': 'Description ready — press “Listen”', 'voice.suggest.fail': 'It did not work — the tavern model gave no answer',
  'voice.suggest.device': 'Description saved, but device voices ignore it — choose an internet source',
  'voice.rate': 'Tempo', 'voice.pitch': 'Pitch', 'voice.test': 'Listen',
  'voice.thoughts': 'Thoughts are read by', 'voice.thoughts.character': 'The character\'s voice', 'voice.thoughts.narrator': 'The narrator\'s voice',
  'voice.none': 'No voices found. On a phone: Settings → Text-to-speech.',
  'voice.other': 'Other languages', 'voice.missing': 'not on this device',
  'unit.ms': 'ms', 'unit.chars': 'chars',
  'speed': 'Overall speed', 'volume': 'Volume', 'pauseMs': 'Pause between paragraphs', 'chunkChars': 'Phrase length',
  'chunkChars.hint': 'Shorter starts faster and highlights more exactly',
  'sample.narrator': 'He turned and was silent for a long time, looking out of the window.', 'sample.character': 'You are late. I was starting to worry.',

  'skip.ooc': 'OOC notes', 'skip.footer': 'Tracker at the end of a reply', 'skip.footer.hint': 'Lines with icons after the last rule',
  'skip.code': 'Code and code blocks', 'skip.links': 'Links',
  'skip.tags': 'Tags to skip', 'skip.tags.hint': 'Comma-separated. Everything inside the tag is skipped.',
  'skip.selectors': 'Page blocks (CSS)', 'skip.selectors.hint': 'For your own inserts: .my-tracker, .panel',
  'skip.regex': 'Own patterns', 'skip.regex.hint': 'One per line. Whatever matches is not read.',

  'look.presets': 'Ready colours', 'look.accent': 'Main colour', 'look.base': 'Player background', 'look.text': 'Text', 'look.mark': 'Phrase highlight',
  'look.auto': 'auto', 'look.opacity': 'Background density', 'look.blur': 'Blur', 'look.radius': 'Rounding', 'look.fontSize': 'Font size',
  'look.scale': 'Player size', 'look.cover': 'Cover', 'cover.avatar': 'Character avatar', 'cover.disc': 'Record', 'cover.none': 'No cover',
  'look.spin': 'Spin the cover while reading',
  'look.bg': 'Background picture', 'look.bg.file': 'Choose a file', 'look.bg.link': 'or a link to a picture', 'look.bg.remove': 'Remove',
  'look.bg.big': 'The picture is too large, take a smaller one', 'look.bg.bad': 'This is not a picture',
  'look.bgDim': 'Picture dimming', 'look.bgFit': 'Placement', 'bgFit.cover': 'Fill', 'bgFit.contain': 'Whole', 'bgFit.tile': 'Tile',
  'look.export': 'Save the look to a file', 'look.import': 'Load a look', 'look.import.bad': 'Could not read the file',

  'danger.note': 'Everything here resets at once. It cannot be undone.',
  'danger.look': 'Reset the look', 'danger.pos': 'Put the player back in place', 'danger.voices': 'Forget character voices',
  'danger.all': 'Reset all settings', 'danger.sure': 'Sure? Press again', 'danger.done': 'Done',
  'debug': 'Write a log to the console',
};

export const DICTIONARIES = Object.freeze({ ru: RU, en: EN });

/** 'ru' or 'en' for the 'auto' choice, from the tavern's language and then the browser's. */
export function resolveLanguage(choice, win = globalThis) {
  if (choice === 'ru' || choice === 'en') return choice;
  let stored = '';
  try { stored = win.localStorage?.getItem('language') ?? ''; } catch { /* storage is off */ }
  const tag = String(stored || win.navigator?.language || 'en').toLowerCase();
  return tag.startsWith('ru') ? 'ru' : 'en';
}

export function createTranslator(language) {
  const dictionary = DICTIONARIES[language] ?? EN;
  return (key, vars) => {
    const template = dictionary[key] ?? EN[key] ?? key;
    return vars ? template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole)) : template;
  };
}
