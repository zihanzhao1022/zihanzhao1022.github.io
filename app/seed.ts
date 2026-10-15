import { mockStore, seedMockStore } from '../editor/results/mockBackend';
import { ACCOUNTS, storeKeyOf } from './accounts';
import { examplePapers } from './example';
import { copyPaper } from './library';
import { Organizer, addFolder, addTag, emptyOrganizer, moveTo, paperKey, setTag, touch } from './organizer';

const SEEDED_KEY = 'galley-examples-v1';
const ORGANIZER_KEY = 'galley-organizer';

export function loadOrganizer(login: string): Organizer {
  try {
    return (JSON.parse(localStorage.getItem(`${ORGANIZER_KEY}:${login}`) ?? 'null') as Organizer | null) ?? emptyOrganizer();
  } catch {
    return emptyOrganizer();
  }
}

export function saveOrganizer(login: string, organizer: Organizer): void {
  try {
    localStorage.setItem(`${ORGANIZER_KEY}:${login}`, JSON.stringify(organizer));
  } catch {
    // The prototype simply forgets.
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Once per browser, the example papers: four in the first account's repository, organized into folders and
 * tagged, and a copy in Alice's, shared with the first account. Everything in them is made up.
 */
async function seed(): Promise<void> {
  const { papers, files } = await examplePapers();
  const [me, alice] = ACCOUNTS;
  const mine = mockStore(storeKeyOf(me.login));
  const fresh = papers.filter((paper) => !mine.papers.some((item) => item.id === paper.id));
  if (fresh.length > 0) seedMockStore(storeKeyOf(me.login), fresh, files);

  const [adapters, survey, notes, poster] = papers;
  const theirs = mockStore(storeKeyOf(alice.login));
  if (!theirs.papers.some((paper) => paper.slug === 'made-up-calibration')) {
    const copy = copyPaper(adapters, (path) => files.get(path), 'res-excalibration', {
      slug: 'made-up-calibration',
      title: 'Made-up study: calibration of small models',
      authors: ['**Alice Chen**', 'Zihan Zhao'],
      venue: 'Made-up Conf 2027',
      hidden: true,
      viewers: [me.login],
      collaboratorIds: { [me.login.toLowerCase()]: me.id },
    });
    seedMockStore(storeKeyOf(alice.login), [copy.paper], copy.files);
  }

  // The first account's papers sorted into folders and tagged, as if used for a while.
  const now = Date.now();
  let organizer = loadOrganizer(me.login);
  if (organizer.folders.length === 0 && organizer.tags.length === 0) {
    const acl = addFolder(organizer, 'ACL 2027', null, now);
    organizer = acl.organizer;
    const surveys = addFolder(organizer, 'Surveys', null, now + 1);
    organizer = surveys.organizer;
    const submitted = addTag(organizer, 'submitted', 'red', now + 2);
    organizer = submitted.organizer;
    const draft = addTag(organizer, 'draft', 'yellow', now + 3);
    organizer = draft.organizer;
    const posterTag = addTag(organizer, 'poster', 'violet', now + 4);
    organizer = posterTag.organizer;
    const key = (id: string) => paperKey(me.login, id);
    organizer = moveTo(organizer, [key(adapters.id), key(notes.id)], acl.id);
    organizer = moveTo(organizer, [key(survey.id)], surveys.id);
    organizer = setTag(organizer, [key(adapters.id)], submitted.id, true);
    organizer = setTag(organizer, [key(notes.id), key(poster.id)], draft.id, true);
    organizer = setTag(organizer, [key(poster.id)], posterTag.id, true);
    organizer = touch(organizer, key(adapters.id), now - 2 * HOUR);
    organizer = touch(organizer, key(notes.id), now - DAY);
    organizer = touch(organizer, key(survey.id), now - 3 * DAY);
    organizer = touch(organizer, key(poster.id), now - 12 * DAY);
    organizer = touch(organizer, paperKey(alice.login, 'res-excalibration'), now - 5 * HOUR);
    saveOrganizer(me.login, organizer);
  }
}

let seeding: Promise<void> | null = null;

/** The examples are in place (once per browser); lists wait for this before they load. */
export function examplesReady(): Promise<void> {
  if (!seeding) {
    let done = false;
    try {
      done = localStorage.getItem(SEEDED_KEY) === '1';
    } catch {
      done = true;
    }
    seeding = done
      ? Promise.resolve()
      : seed().then(
          () => {
            try {
              localStorage.setItem(SEEDED_KEY, '1');
            } catch {
              // Seeds again next time; the checks above keep it from doubling.
            }
          },
          () => undefined,
        );
  }
  return seeding;
}
