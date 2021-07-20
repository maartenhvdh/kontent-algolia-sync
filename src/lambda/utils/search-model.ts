type KontentConfiguration = {
  projectId: string,
  language?: string,
  slugCodename: string
}

type AlgoliaConfiguration = {
  appId: string,
  apiKey: string,
  index: string
}

type SearchProjectConfiguration = {
  kontent: KontentConfiguration,
  algolia: AlgoliaConfiguration
}

type SearchableItem = {
  id: string,
  objectID: string,
  codename: string,
  name: string,
  question: string,
  answer: string,
  screenshots: string,
  reference: string,
  date: Date,
  type: string,
  client: string,        
  source: string,
  language: string,
  contenttype: string,
  slug: string,
  collection: string,
  content: ContentBlock[]
}

type ContentBlock = {
  id: string,
  codename: string,
  name: string,
  question: string,
  answer: string,
  screenshots: string,
  reference: string,
  date: Date,
  type: string,
  client: string,        
  source: string,
  contenttype: string,
  language: string,
  collection: string,
  parents: string[],
  contents: string
}

export { SearchProjectConfiguration, SearchableItem, ContentBlock, AlgoliaConfiguration, KontentConfiguration }