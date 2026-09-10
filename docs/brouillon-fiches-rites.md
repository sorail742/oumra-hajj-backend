> ⚠️ **BROUILLON — à valider par une personne qualifiée avant toute
> publication ou intégration en base.** Aucune fiche de ce document n'est
> finale. Voir `CLAUDE.md` (section « Contenu religieux »),
> `docs/adr/0008-stockage-documents-sensibles.md` et le cahier des charges
> §3.4 (« Modération de contenu »). `RiteSheet.isValidated` doit rester à
> `false` pour chacune de ces fiches tant qu'une relecture qualifiée n'a pas
> eu lieu explicitement (voir `src/modules/rites/schemas/rite-sheet.schema.ts`).

# Brouillon — fiches du guide des rites (issue #17)

Propositions de contenu pour une dizaine de fiches de la Oumra et quelques
fiches clés du Hadj, au format attendu par `CreateRiteSheetDto`
(`key`, `title`, `pilgrimageType`, `order`, `content`, `language`). Ce
document **ne contient aucun code, aucun script de seed, aucune insertion en
base** — c'est un texte de travail à faire relire.

## Portée et limites assumées de ce brouillon

- S'en tient au **consensus majoritaire largement admis** de la pratique
  sunnite de la Oumra/du Hadj. Ce n'est pas une base multiconfessionnelle ni
  exhaustive des positions de toutes les écoles (madhabs).
- Quand une divergence connue entre écoles existe sur un point précis, elle
  est signalée explicitement dans la fiche concernée plutôt que tranchée.
- Points volontairement **non traités** ici, car trop larges pour un
  brouillon raisonnable et à trancher par la personne qualifiée plutôt que
  par ce document :
  - le choix entre les trois formes du Hadj (Ifrad, Tamattu, Qiran) et leurs
    implications (sacrifice dû ou non) — dépend de l'école suivie et du
    montage avec l'agence, hors périmètre de ce brouillon ;
  - les règles précises de compensation (fidya/dam) en cas de rite manqué ou
    mal exécuté ;
  - la gradation d'authenticité (sahih/hasan/da'if) de chaque hadith cité —
    les invocations reprises ici sont celles largement diffusées dans les
    guides de pèlerinage, mais leur chaîne de transmission doit être
    revérifiée par la personne qualifiée avant publication.
- Les invocations sont données en **translittération + traduction française**,
  pas seulement en arabe, comme demandé — la graphie arabe exacte est à
  faire valider également (diacritiques, choix de translittération).

---

## Fiche 1 — Ihram : intention et tenue sacrée

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `ihram-intention`
- `title`: Ihram — Intention et tenue sacrée
- `pilgrimageType`: `both`
- `order`: 1
- `language`: `fr`

**Contenu proposé :**
L'Ihram est l'état de sacralisation dans lequel le pèlerin entre avant de
franchir les limites sacrées (Miqat), et qui marque le début officiel de la
Oumra ou du Hadj. Il comprend deux volets : une tenue spécifique et une
intention (niyyah) formulée intérieurement.

Pour les hommes : deux pièces de tissu blanc non cousues (izar autour de la
taille, rida' sur les épaules), tête découverte, sandales laissant apparaître
le cou-de-pied. Pour les femmes : vêtements amples et modestes couvrant tout
le corps sauf le visage et les mains, dans la couleur de leur choix (le blanc
n'est pas une obligation pour elles) ; le visage ne doit pas être couvert par
un tissu qui le touche directement (les modalités précises en présence
d'hommes non mahram varient selon les écoles — à clarifier avec une personne
qualifiée).

Une fois l'Ihram entamé, certains actes sont interdits jusqu'à la sortie de
cet état : se parfumer, couper cheveux ou ongles, chasser, avoir des rapports
conjugaux, se disputer. L'intention se formule simplement, par exemple :
« Me voici, ô Allah, en Oumra » ou « en Hadj », selon le cas.

---

## Fiche 2 — La Talbiya

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `talbiya`
- `title`: La Talbiya — invocation d'entrée en Ihram
- `pilgrimageType`: `both`
- `order`: 2
- `language`: `fr`

**Contenu proposé :**
Dès l'entrée en Ihram, le pèlerin répète la Talbiya à voix haute (pour les
hommes) ou à voix basse (pour les femmes), en marchant, en montant dans un
véhicule, et régulièrement jusqu'au début du Tawaf (pour la Oumra) ou jusqu'au
jet du premier jamra le jour de l'Aïd (pour le Hadj).

**Invocation :**
- Arabe : لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ
- Translittération : *Labbayk Allahumma labbayk, labbayka la sharika laka
  labbayk, inna al-hamda wa-n-ni'mata laka wal-mulk, la sharika lak.*
- Traduction FR : « Me voici, ô Allah, me voici. Me voici, Tu n'as pas
  d'associé, me voici. Certes la louange, le bienfait et la royauté
  T'appartiennent, Tu n'as pas d'associé. »

---

## Fiche 3 — Entrée à la Mosquée Sacrée (Masjid al-Haram)

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `entree-masjid-al-haram`
- `title`: Entrée à la Mosquée Sacrée
- `pilgrimageType`: `both`
- `order`: 3
- `language`: `fr`

**Contenu proposé :**
Comme pour toute mosquée, on entre du pied droit en formulant une invocation
d'entrée, puis on se dirige vers la Kaaba pour débuter le Tawaf sans prière
de salutation de la mosquée préalable (le Tawaf en tient lieu à la Mosquée
Sacrée).

**Invocation d'entrée (usage général, non spécifique au Haram) :**
- Arabe : بِسْمِ اللَّهِ وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ، اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ
- Translittération : *Bismillah was-salatu was-salamu 'ala rasulillah,
  Allahumma-ftah li abwaba rahmatik.*
- Traduction FR : « Au nom d'Allah, et que la prière et le salut soient sur
  le Messager d'Allah. Ô Allah, ouvre-moi les portes de Ta miséricorde. »

---

## Fiche 4 — Tawaf : les sept tours autour de la Kaaba

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `tawaf`
- `title`: Tawaf — les sept tours autour de la Kaaba
- `pilgrimageType`: `both`
- `order`: 4
- `language`: `fr`

**Contenu proposé :**
Le Tawaf consiste à effectuer sept tours complets autour de la Kaaba, en la
gardant à sa gauche, en commençant et terminant chaque tour au niveau de la
Pierre Noire (Hajar al-Aswad). Si possible, on touche ou embrasse la Pierre
Noire à chaque passage ; sinon, on la désigne de la main droite en disant
« Allahu Akbar », sans se bousculer.

Entre le Coin Yéménite (Rukn Yamani) et la Pierre Noire, il est rapporté de
réciter :
- Arabe : رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ
- Translittération : *Rabbana atina fid-dunya hasanatan wa fil-akhirati
  hasanatan wa qina 'adhaban-nar.*
- Traduction FR : « Seigneur, accorde-nous belle part ici-bas et belle part
  dans l'au-delà, et préserve-nous du châtiment du Feu. » (Coran 2:201)

En dehors de ce passage, aucune formule n'est imposée : chacun peut invoquer
librement.

**Divergence entre écoles à signaler :** l'état de purification (wudu)
pendant le Tawaf est considéré comme une **condition de validité** par les
écoles chaféite et hanbalite, et comme **fortement recommandé mais non
obligatoire** par les écoles hanafite et malikite. Ce point conditionne ce
qu'il faut faire en cas de doute sur la validité des ablutions pendant le
Tawaf — à trancher avec une personne qualifiée selon l'école suivie par le
pèlerin.

---

## Fiche 5 — Prière derrière la Station d'Ibrahim

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `salat-maqam-ibrahim`
- `title`: Prière derrière la Station d'Ibrahim
- `pilgrimageType`: `both`
- `order`: 5
- `language`: `fr`

**Contenu proposé :**
Après les sept tours, on accomplit si possible deux unités de prière (rak'ah)
derrière ou à proximité de la Station d'Ibrahim (Maqam Ibrahim), en
récitant la sourate Al-Kafirun après Al-Fatiha à la première unité et
Al-Ikhlas à la seconde (pratique rapportée, non obligatoire dans son détail).
Si l'affluence ne permet pas de s'approcher, la prière peut être accomplie à
n'importe quel autre endroit de la mosquée.

---

## Fiche 6 — Boire l'eau de Zamzam

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `zamzam`
- `title`: Boire l'eau de Zamzam
- `pilgrimageType`: `both`
- `order`: 6
- `language`: `fr`

**Contenu proposé :**
Après la prière derrière la Station d'Ibrahim, il est recommandé de boire de
l'eau de Zamzam à satiété, en se tournant si possible vers la Kaaba, et
d'invoquer Allah pour ce que l'on souhaite — il est rapporté que l'eau de
Zamzam répond à l'intention pour laquelle elle est bue. Aucune formule fixe
n'est requise ; chacun formule son invocation librement.

---

## Fiche 7 — Sa'i : marche entre Safa et Marwa

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `sai`
- `title`: Sa'i — marche entre Safa et Marwa
- `pilgrimageType`: `both`
- `order`: 7
- `language`: `fr`

**Contenu proposé :**
Le Sa'i consiste à parcourir sept fois la distance entre les monts Safa et
Marwa (un aller = un tour, un retour = un tour), en commençant par Safa. En
montant sur Safa la première fois, on se tourne vers la Kaaba et on récite :

- Arabe : إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ، أَبْدَأُ بِمَا بَدَأَ اللَّهُ بِهِ
- Translittération : *Inna as-safa wal-marwata min sha'a'irillah, abda'u bima
  bada Allahu bih.*
- Traduction FR : « Safa et Marwa font partie des rites institués par
  Allah. Je commence par ce par quoi Allah a commencé. » (reprend Coran
  2:158)

Entre les deux repères verts, les hommes sont invités à accélérer le pas
(les femmes marchent à allure normale sur tout le parcours). Aucune formule
précise n'est obligatoire pendant la marche elle-même — chacun invoque
librement.

**Divergence à signaler :** contrairement au Tawaf, l'état de purification
(wudu) n'est pas une condition de validité du Sa'i pour la majorité des
écoles, mais il reste recommandé par précaution — à confirmer par la
personne qualifiée selon l'école suivie.

---

## Fiche 8 — Taqsir / Halq : fin de la Oumra

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `taqsir-halq`
- `title`: Taqsir / Halq — fin de la Oumra
- `pilgrimageType`: `oumra`
- `order`: 8
- `language`: `fr`

**Contenu proposé :**
La Oumra se termine par la coupe des cheveux : les hommes peuvent choisir
entre raser entièrement la tête (Halq, considéré comme plus méritoire) ou
raccourcir l'ensemble des cheveux (Taqsir). Les femmes ne se rasent jamais
la tête : elles coupent seulement une longueur d'environ un bout de doigt
sur l'ensemble de la chevelure. Cet acte marque la sortie de l'état d'Ihram
et la levée de tous ses interdits.

---

## Fiche 9 — Journée de Tarwiya à Mina (8 Dhou al-Hijja)

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `mina-tarwiya`
- `title`: Journée de Tarwiya — départ vers Mina
- `pilgrimageType`: `hadj`
- `order`: 9
- `language`: `fr`

**Contenu proposé :**
Le 8 Dhou al-Hijja (« jour de Tarwiya »), les pèlerins déjà arrivés en Ihram
de Hadj (selon la forme retenue avec leur agence — Ifrad, Tamattu ou Qiran,
sujet non détaillé dans ce brouillon) se dirigent vers Mina, où ils
accomplissent les prières de la journée et de la nuit en les raccourcissant
(sans les regrouper), en attendant le départ pour Arafat le lendemain matin.

---

## Fiche 10 — Wuquf : la station à Arafat (9 Dhou al-Hijja)

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `arafat`
- `title`: Wuquf — station à Arafat
- `pilgrimageType`: `hadj`
- `order`: 10
- `language`: `fr`

**Contenu proposé :**
La station à Arafat, du zénith du 9 Dhou al-Hijja jusqu'au coucher du soleil,
est le pilier central du Hadj — il est rapporté que « le Hadj, c'est
Arafat » : un pèlerin qui n'y a pas été présent pendant cette fenêtre n'a
pas accompli le Hadj cette année-là. On y multiplie les invocations,
notamment :

- Arabe : لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ
- Translittération : *La ilaha illallah wahdahu la sharika lah, lahul-mulku
  wa lahul-hamdu wa huwa 'ala kulli shay'in qadir.*
- Traduction FR : « Il n'y a de divinité digne d'adoration qu'Allah, Seul,
  sans associé. À Lui la royauté, à Lui la louange, et Il est capable de
  toute chose. »

Les prières de midi et d'après-midi sont regroupées et raccourcies.

---

## Fiche 11 — Muzdalifah : nuit et collecte des cailloux

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `muzdalifah`
- `title`: Muzdalifah — nuit et collecte des cailloux
- `pilgrimageType`: `hadj`
- `order`: 11
- `language`: `fr`

**Contenu proposé :**
Après le coucher du soleil à Arafat, les pèlerins se rendent à Muzdalifah où
ils regroupent les prières du Maghreb et de l'Isha, puis passent la nuit à
la belle étoile. C'est l'occasion de ramasser les cailloux (généralement une
soixantaine à une soixante-dizaine, selon le nombre de jours de Tashriq où
le pèlerin restera à Mina) qui serviront au Rami les jours suivants.

**Divergence à signaler :** le statut de la présence à Muzdalifah diffère
selon les écoles — l'école hanafite la considère comme un **pilier (rukn)**
du Hadj, tandis que d'autres écoles la considèrent comme une **obligation
(wajib)** dont l'omission peut être compensée. Cette différence a des
conséquences importantes en cas d'empêchement (affluence, santé) — à
clarifier impérativement avec une personne qualifiée, ce brouillon ne
tranche pas.

---

## Fiche 12 — Rami : lapidation des stèles à Mina

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `rami-jamarat`
- `title`: Rami — lapidation des stèles à Mina
- `pilgrimageType`: `hadj`
- `order`: 12
- `language`: `fr`

**Contenu proposé :**
Le jour de l'Aïd (10 Dhou al-Hijja), le pèlerin lance sept cailloux sur la
grande stèle (Jamrat al-Aqaba), en disant « Allahu Akbar » à chaque jet.
Les jours suivants (Tashriq, 11 et 12, parfois 13 Dhou al-Hijja), il lance
sept cailloux sur chacune des trois stèles, dans l'ordre (petite, moyenne,
grande). Les personnes âgées, malades ou incapables de se déplacer peuvent
mandater quelqu'un pour lancer à leur place (tawkil), une facilité largement
admise par les écoles.

**Point à noter, non tranché ici :** les autorités saoudiennes modernes
autorisent aujourd'hui le Rami à différentes heures de la journée (et non
plus seulement après le zénith comme dans la pratique historique) pour
désengorger les flux de pèlerins — les consignes précises évoluent d'une
année à l'autre et doivent être suivies via l'agence/le guide sur place
plutôt que via une règle fixée dans l'application.

---

## Fiche 13 — Sacrifice, Taqsir/Halq et Tawaf al-Ifadah

> ⚠️ BROUILLON — à valider par une personne qualifiée avant toute publication ou intégration en base.

- `key`: `sacrifice-tawaf-ifadah`
- `title`: Sacrifice, coupe des cheveux et Tawaf al-Ifadah
- `pilgrimageType`: `hadj`
- `order`: 13
- `language`: `fr`

**Contenu proposé :**
Après le Rami du jour de l'Aïd, le pèlerin (selon la forme de Hadj retenue)
procède ou fait procéder au sacrifice (Udhiya) — aujourd'hui très
majoritairement délégué via un bon/voucher auprès d'un abattoir agréé plutôt
qu'effectué personnellement — puis se coupe les cheveux (Halq pour les
hommes, de préférence, ou Taqsir ; Taqsir uniquement pour les femmes, voir
fiche 8). Il peut ensuite se rendre à la Mosquée Sacrée pour effectuer le
Tawaf al-Ifadah (un des piliers du Hadj) et, si ce n'est pas déjà fait dans
le cadre d'un Hadj de type Tamattu, le Sa'i entre Safa et Marwa. À l'issue de
ces trois actes (Rami, sacrifice, Tawaf al-Ifadah), la plupart des interdits
de l'Ihram sont levés.

---

## Résumé — table de correspondance avec le DTO

| `key` | `title` | `pilgrimageType` | `order` |
|---|---|---|---|
| `ihram-intention` | Ihram — Intention et tenue sacrée | both | 1 |
| `talbiya` | La Talbiya | both | 2 |
| `entree-masjid-al-haram` | Entrée à la Mosquée Sacrée | both | 3 |
| `tawaf` | Tawaf — les sept tours | both | 4 |
| `salat-maqam-ibrahim` | Prière derrière la Station d'Ibrahim | both | 5 |
| `zamzam` | Boire l'eau de Zamzam | both | 6 |
| `sai` | Sa'i — Safa et Marwa | both | 7 |
| `taqsir-halq` | Taqsir / Halq — fin de la Oumra | oumra | 8 |
| `mina-tarwiya` | Journée de Tarwiya à Mina | hadj | 9 |
| `arafat` | Wuquf — station à Arafat | hadj | 10 |
| `muzdalifah` | Muzdalifah — nuit et cailloux | hadj | 11 |
| `rami-jamarat` | Rami — lapidation des stèles | hadj | 12 |
| `sacrifice-tawaf-ifadah` | Sacrifice, Halq/Taqsir, Tawaf al-Ifadah | hadj | 13 |

## Rappel avant toute suite

Ce document reste un **brouillon de travail**. Avant toute intégration
(seed, insertion en base, publication dans l'app) :

1. Faire relire chaque fiche par une personne qualifiée (contenu, sourcing
   des invocations, formulation des divergences signalées).
2. Ne lever `isValidated` à `true` qu'après cette relecture explicite (voir
   `src/modules/rites/schemas/rite-sheet.schema.ts`).
3. Envisager une traduction/adaptation pour les langues locales et l'arabe
   (`language: 'en' | 'ar'`), également à faire valider, pas seulement
   traduire mécaniquement le français.
