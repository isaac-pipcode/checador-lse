/**
 * Léxico de classes fechadas do português brasileiro.
 *
 * O módulo não faz análise sintática profunda: faz *chunking* de superfície
 * baseado em classes fechadas (determinantes, preposições, contrações,
 * conjunções, pronomes, auxiliares). É por isso que suas saídas entram como
 * sugestões com confiança explícita, e nunca como correção automática.
 */

const set = (...palavras: string[]) => new Set(palavras);

export const ARTIGOS_E_DETERMINANTES = set(
  'o','a','os','as','um','uma','uns','umas',
  'este','esta','estes','estas','esse','essa','esses','essas',
  'aquele','aquela','aqueles','aquelas','isto','isso','aquilo',
  'meu','minha','meus','minhas','teu','tua','teus','tuas','seu','sua','seus','suas',
  'nosso','nossa','nossos','nossas','vosso','vossa','dele','dela','deles','delas',
  'cujo','cuja','cujos','cujas','algum','alguma','alguns','algumas',
  'nenhum','nenhuma','nenhuns','nenhumas','todo','toda','todos','todas',
  'outro','outra','outros','outras','muito','muita','muitos','muitas',
  'pouco','pouca','poucos','poucas','vário','vária','vários','várias',
  'qualquer','quaisquer','cada','tal','tais','certo','certa','certos','certas',
  'tanto','tanta','tantos','tantas','quanto','quanta','quantos','quantas',
  'mesmo','mesma','mesmos','mesmas','próprio','própria','ambos','ambas',
);

export const PREPOSICOES = set(
  'a','ante','após','até','com','contra','de','desde','em','entre','para','perante',
  'por','sem','sob','sobre','trás','pra','pro','pras','pros','conforme','durante',
  'mediante','salvo','exceto','consoante','via',
);

/** Contrações preposição + determinante/pronome: nunca terminam uma linha. */
export const CONTRACOES = set(
  'do','da','dos','das','no','na','nos','nas','ao','aos','à','às','àquele','àquela',
  'num','numa','nuns','numas','dum','duma','duns','dumas',
  'pelo','pela','pelos','pelas','neste','nesta','nestes','nestas',
  'nesse','nessa','nesses','nessas','naquele','naquela','naqueles','naquelas',
  'deste','desta','destes','destas','desse','dessa','desses','dessas',
  'daquele','daquela','daqueles','daquelas','disto','disso','daquilo',
  'nisto','nisso','naquilo','dele','dela','deles','delas','donde','aonde','doutro',
);

export const CONJUNCOES = set(
  'e','ou','mas','porém','contudo','todavia','entretanto','porque','pois','que','se',
  'quando','enquanto','embora','conquanto','caso','como','portanto','logo','nem',
  'tampouco','ora','quer','senão','porquanto','conquanto','ainda','apesar','posto',
  'assim','mal','desde','já','seja',
);

export const RELATIVOS = set('que','quem','qual','quais','cujo','cuja','cujos','cujas','onde','quanto');

/** Pronomes que se ligam ao verbo (proclíticos) ou encabeçam sintagma. */
export const PRONOMES = set(
  'eu','tu','ele','ela','nós','vós','eles','elas','você','vocês','me','te','se','lhe',
  'lhes','nos','vos','mim','ti','si','comigo','contigo','consigo','conosco','convosco',
);

/** Formas verbais auxiliares e de verbos-suporte mais frequentes. */
export const AUXILIARES = set(
  'é','são','era','eram','foi','foram','sou','somos','seja','sejam','fosse','fossem','ser','sendo','sido','será','serão','seria','seriam',
  'está','estão','estou','estamos','estava','estavam','esteve','estiveram','estar','estando','estado','estará','estarão','estaria',
  'tem','têm','tenho','temos','tinha','tinham','teve','tiveram','ter','tendo','tenha','tenham','terá','terão','teria','teriam',
  'há','havia','houve','haver','havendo','haja','houvesse','haverá','haveria',
  'vai','vão','vou','vamos','ia','iam','ir','indo','irá','irão','iria','iriam',
  'pode','podem','posso','podemos','podia','podiam','pôde','puderam','poder','podendo','poderá','poderia','poderiam',
  'deve','devem','devo','devemos','devia','deviam','dever','devendo','deverá','deveria',
  'quer','querem','quero','queremos','queria','queriam','querer','querendo',
  'vem','vêm','venho','vimos','vinha','vinham','veio','vieram','vir','vindo',
  'fica','ficam','ficou','ficaram','ficar','ficando','continua','continuam','continuar',
  'começa','começam','começou','começar','acaba','acabam','acabou','acabar',
  'costuma','costumam','precisa','precisam','preciso','precisamos','deixa','deixam',
);

/** Advérbios que se agarram ao verbo ou ao adjetivo seguinte. */
export const ADVERBIOS_LIGADOS = set(
  'não','nunca','jamais','já','ainda','sempre','também','só','apenas','somente',
  'muito','mais','menos','bem','mal','quase','talvez','tão','bastante','demais',
);

export type Classe =
  | 'determinante'
  | 'preposicao'
  | 'contracao'
  | 'conjuncao'
  | 'relativo'
  | 'pronome'
  | 'auxiliar'
  | 'adverbio'
  | 'aberta';

/** Normaliza a palavra para consulta ao léxico: minúsculas, sem pontuação/markup. */
export function normalizar(palavra: string): string {
  return palavra
    .replace(/<\/?[^>]+>/g, '')
    .replace(/[.,!?;:"“”'’()\[\]…]/g, '')
    .replace(/^[-–—]+/, '')
    .toLowerCase()
    .trim();
}

/**
 * Classifica pela pertença a classes fechadas. Onde há ambiguidade real
 * (p. ex. "a" artigo/preposição/pronome; "que" conjunção/relativo), a ordem de
 * consulta escolhe a classe que produz a restrição mais forte de quebra — o que
 * é o comportamento desejado: em qualquer das leituras, a palavra rege o que vem
 * depois e não pode encerrar a linha.
 */
export function classificar(palavra: string): Classe {
  const p = normalizar(palavra);
  if (!p) return 'aberta';
  if (CONTRACOES.has(p)) return 'contracao';
  if (PREPOSICOES.has(p)) return 'preposicao';
  if (ARTIGOS_E_DETERMINANTES.has(p)) return 'determinante';
  if (RELATIVOS.has(p)) return 'relativo';
  if (CONJUNCOES.has(p)) return 'conjuncao';
  if (PRONOMES.has(p)) return 'pronome';
  if (AUXILIARES.has(p)) return 'auxiliar';
  if (ADVERBIOS_LIGADOS.has(p)) return 'adverbio';
  return 'aberta';
}
