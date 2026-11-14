# Sable Voice

A voice player for SillyTavern 1.19.x. It reads replies aloud, with one voice for the narrator and another for the character, and shows a small player with play, pause, phrase steps and speed. The menu is in Russian and English.

[По-русски](#ru)

## Install

1. In SillyTavern, open **Extensions → Install extension**, paste this repository's URL and install.
2. Reload SillyTavern.
3. Press ▶ on the player or on any message.

Out of the box it uses the voices built into your device, which are free and need no key.

## What it does

- **Two voices.** Text outside quotes is read by the narrator, text in quotes by the character. Italics can count as thoughts or as actions. A character can have a voice of their own.
- **Player.** Floating button, a bar at the top or bottom, or a mini panel at the side. Small card or a large one with a cover.
- **Follows the text.** The phrase being read is highlighted and the chat scrolls with it. Tap a phrase to read from there.
- **Keeps going.** It can read a new reply as soon as it is finished and continue to the next message.
- **Skips the clutter.** OOC notes, trackers at the end of a reply, code, links, tags you list, page blocks and your own patterns are not read.
- **Look.** Colours, background picture, size, cover; the look can be saved to a file and loaded.
- **Cast.** Switch on «Different voices for other people»: the model marks who speaks (`[v:Name]`, hidden on the page) and each person in the list gets a voice of their own; «another man» and «another woman» catch the rest. New replies only.
- **Counter.** Today's phrases and how many went to an internet voice; type a price per phrase to see the day's total.
- **Save the sound.** A button in the player (off by default) saves the whole reply as one file: mp3 when the voice gives mp3, wav otherwise. Device voices cannot be saved.

## Voice sources

Each voice (narrator, character, a character's own) picks its source in **Voices**:

| Source | Needs | Notes |
| --- | --- | --- |
| This device | nothing | Free. Voices depend on the browser and the system. |
| OpenRouter | an OpenRouter key | Speech models from its list, free ones are marked. Some take a text description of the voice instead of a voice name. |
| Own address 1 and 2 (OpenAI-shaped) | address and key | Any server that answers like OpenAI's `/audio/speech`. Its voice models are listed when it has a model list; Gemini voice models there are asked the Gemini way. |
| Google Gemini | a Google AI Studio key | 30 voices and a style description. |
| ElevenLabs | an ElevenLabs key | Your own voices are listed once the key is in. |

Keys are typed under **Voices → Keys**. They are stored as plain text in the settings of your SillyTavern and are sent only to their own service, straight from the browser. Internet voices cost whatever the service charges.

The open character can have a voice of its own. **Suggest from the card** asks the tavern's current model to describe the voice from the card in a phrase or two (one short request); the description is used by models that take a voice description.

## Reading with the screen off

Internet voices keep reading when SillyTavern is not on the screen: another app in front, another tab, a locked phone. The lock screen gets play, pause and phrase buttons. Device voices cannot do this; the phone stops them when the page is hidden.

## Limits

- Group chats are not tested.
- Device voices differ a lot between browsers; some phones have none until a speech engine is installed in the system settings.

## Development

```
npm install
npm test
```

<a id="ru"></a>

# Sable Voice — по-русски

Плеер с озвучкой для SillyTavern 1.19.x. Читает ответы вслух: один голос у нарратора, другой у персонажа. Маленький плеер с кнопками: читать, пауза, шаг по фразам, скорость. Меню на русском и английском.

## Установка

1. В SillyTavern открой **Extensions → Install extension**, вставь ссылку на этот репозиторий и установи.
2. Перезагрузи SillyTavern.
3. Нажми ▶ на плеере или у любого сообщения.

Сразу после установки работают голоса самого устройства: бесплатно и без ключей.

## Что умеет

- **Два голоса.** Текст вне кавычек читает нарратор, текст в кавычках читает персонаж. Курсив можно считать мыслями или действиями. Персонажу можно дать свой голос.
- **Плеер.** Плавающая кнопка, полоска сверху или снизу, мини-панель сбоку. Карточка маленькая или большая, с обложкой.
- **Идёт по тексту.** Читаемая фраза подсвечивается, чат листается следом. Тап по фразе читает с неё.
- **Не останавливается.** Может читать новый ответ, как только он дописан, и переходить к следующему сообщению.
- **Пропускает лишнее.** OOC-заметки, трекер в конце ответа, код, ссылки, указанные теги, блоки страницы и свои шаблоны не читаются.
- **Внешний вид.** Цвета, картинка на фон, размер, обложка; вид сохраняется в файл и загружается из него.
- **Состав.** Галочка «Разные голоса для других героев»: модель помечает, кто говорит (`[v:Имя]`, на экране не видно), и каждому из списка достаётся свой голос; «другой мужчина» и «другая женщина» ловят остальных. Только на новых ответах.
- **Счётчик.** Сколько фраз озвучено сегодня и сколько ушло в интернет-голос; впиши цену за фразу, и будет видно, сколько набежало за день.
- **Сохранить звук.** Кнопка в плеере (по умолчанию выключена) сохраняет весь ответ одним файлом: mp3, если голос отдаёт mp3, иначе wav. Голоса устройства не сохраняются.

## Откуда голоса

У каждого голоса (нарратор, персонаж, свой голос персонажа) источник выбирается в разделе **Голоса**:

| Источник | Что нужно | Заметки |
| --- | --- | --- |
| Это устройство | ничего | Бесплатно. Голоса зависят от браузера и системы. |
| OpenRouter | ключ OpenRouter | Речевые модели из его списка, бесплатные помечены. Некоторым вместо имени голоса нужно описание словами. |
| Свой адрес 1 и 2 (как у OpenAI) | адрес и ключ | Любой сервер, который отвечает как `/audio/speech` у OpenAI. Голосовые модели подтягиваются списком, если сервер его отдаёт; голосовые модели Gemini спрашиваются по-гемини. |
| Google Gemini | ключ Google AI Studio | 30 голосов и описание манеры. |
| ElevenLabs | ключ ElevenLabs | Свои голоса появятся в списке, когда вписан ключ. |

Ключи вписываются в **Голоса → Ключи**. Они лежат открытым текстом в настройках твоей таверны и уходят только в свой сервис, прямо из браузера. Интернет-голоса стоят столько, сколько берёт сервис.

У открытого персонажа может быть свой голос. Кнопка **Подобрать по карточке** просит текущую модель таверны описать голос по карточке в паре фраз (один короткий запрос); описание пригодится моделям, которые понимают описание голоса.

## Чтение с выключенным экраном

Интернет-голоса продолжают читать, когда таверны нет на экране: открыто другое приложение, другая вкладка, телефон заблокирован. На экране блокировки появляются кнопки: читать, пауза, шаг по фразам. Голоса устройства так не умеют: телефон сам останавливает их, когда страница скрыта.

## Ограничения

- Групповые чаты не проверялись.
- Голоса устройства сильно отличаются от браузера к браузеру; на некоторых телефонах их нет, пока в настройках системы не установлен синтез речи.

## License

MIT
