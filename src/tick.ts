/* eslint-disable import/prefer-default-export */
import { clipboard, NativeImage } from 'electron';
import { interval, merge } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  share,
  skip,
  tap,
} from 'rxjs/operators';
import { format } from 'date-fns';
import { writeFile } from 'fs/promises';
import { mkdir } from 'shelljs';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { existsSync } from 'fs';
import path from 'path';
import { kitPath } from './helpers';

export const tick = async () => {
  const tmpClipboardDir = kitPath('tmp', 'clipboard');
  if (!existsSync(tmpClipboardDir)) {
    mkdir('-p', tmpClipboardDir);
  }

  const adapter = new FileSync(kitPath('db', 'clipboard-history.json'));
  const db = low(adapter);

  db.defaults({ history: [] }).write();

  const tick$ = interval(1000).pipe(share());

  const clipboardText$ = tick$.pipe(
    map(() => clipboard.readText()),
    filter(Boolean),
    skip(1),
    distinctUntilChanged()
  );

  let image: NativeImage | null = null;
  const clipboardImage$ = tick$.pipe(
    tap(() => {
      image = clipboard.readImage();
    }),
    filter(() => Boolean(image)),
    skip(1),
    map(() => image?.toDataURL()),
    filter((dataUrl) => !dataUrl?.endsWith(',')),
    distinctUntilChanged(),
    map(() => image)
  );

  merge(clipboardText$, clipboardImage$).subscribe(async (textOrImage) => {
    let value = '';
    let type = '';
    const timestamp = format(new Date(), 'yyyy-MM-dd-hh-mm-ss');

    if (typeof textOrImage === 'string') {
      type = 'text';
      value = textOrImage;
    } else {
      type = 'image';
      value = path.join(tmpClipboardDir, `${timestamp}.png`);
      await writeFile(value, (textOrImage as NativeImage).toPNG());
    }

    const secret = Boolean(
      type === 'text' &&
        value.match(/^(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]{5,})$/gi)
    );
    db.update('history', (history) =>
      [{ value, type, timestamp, secret }, ...history].slice(0, 50)
    ).write();
  });
};