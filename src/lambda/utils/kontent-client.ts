import {  IContentItem, DeliveryClient, Elements, camelCasePropertyNameResolver } from '@kontent-ai/delivery-sdk';
import { KontentConfiguration, SearchableItem, ContentBlock } from "./search-model";

class KontentClient {
  config: KontentConfiguration;
  deliveryClient: DeliveryClient;

  constructor(config: KontentConfiguration) {
    this.config = config;
    this.deliveryClient = new DeliveryClient({ environmentId: this.config.projectId,
      previewApiKey: process.env.NEXT_PUBLIC_KONTENT_PREVIEW_API_KEY,
      defaultQueryConfig: {
        usePreviewMode: true,
        waitForLoadingNewContent: true
      },
      propertyNameResolver: camelCasePropertyNameResolver });
  }

  // PRIVATE: processes linked content + components
  _getLinkedContent(codenames: string[], parents: string[], children: string[], allContent: IContentItem[]) {
        const linkedContent: ContentBlock[] = [];

        for (const linkedCodename of codenames) {
            const foundLinkedItem: IContentItem | undefined = allContent.find(i => i.system.codename == linkedCodename);
            // IF THE LINKED ITEM CONTAINS SLUG, IT'S NOT BEING INCLUDED IN THE PARENT'S CONTENT

            if (foundLinkedItem) {
                children.push(foundLinkedItem.system.codename);
                if (!foundLinkedItem[this.config.slugCodename]) {// if the item doesn't have a slug -> include
                    linkedContent.push(...this.getContentFromItem(foundLinkedItem, parents, children, allContent));
                }
            }
        }

        return linkedContent;
  }

  // returns all content, including linked items in one flat array of IContentItems
  async getAllContentFromProject(): Promise<IContentItem[]> {
    if (!this.config.language) return [];
    const feed = await this.deliveryClient
    .items()
    .queryConfig({ waitForLoadingNewContent: true })
      .languageParameter(this.config.language)
      .equalsFilter("system.language", this.config.language)
      .toPromise();
    
    // all content items (including modular content) + components put into one array
    return [...feed.data.items, ...Object.keys(feed.data.linkedItems).map(key => feed.data.linkedItems[key])]
  }

  async getAllContentForCodename(codename: string): Promise<IContentItem[]> {
    if (!this.config.language) return [];
    try {
      const content = await this.deliveryClient.item(codename).queryConfig({ waitForLoadingNewContent: true })
        .languageParameter(this.config.language).depthParameter(100).toPromise();

      // all content items (including modular content) + components put into one array
      return [content.data.item, ...Object.keys(content.data.linkedItems).map(key => content.data.linkedItems[key])];
    }
    catch (error) {
      return [];
    }
  }

  // extracts text content from an item + linked items
  getContentFromItem(item: IContentItem, parents: string[], children: string[], allContent: IContentItem[]): ContentBlock[] {
    if (!item) return [];

    // array of linked content for this item
    let linkedContent: ContentBlock[] = [];
    const contents: string[] = [];

    // content of the currently processed item
    let itemsContent: ContentBlock = {
      id: item.system.id,
      codename: item.system.codename,
      language: item.system.language,
      collection: item.system.collection,
      contenttype: item.system.type,
      name: item.system.name,
      question: item.elements.question.value,
      answer: item.elements.answer.value,
      lastmodified: new Date(item.system.lastModified),
      type: item.elements.type.value,
      categories: item.elements.categories.value,        
      parents: parents,
      contents: ""
    };

    // go over each element and extract it's contents
    // ONLY FOR TEXT/RICH-TEXT + LINKED ITEMS (modular content)
    for (let propName in item.elements) {
      const camelCasePropName = getCamelCaseName(propName)
      const property: any = item.elements[camelCasePropName];
      const type: string = property?.type;
      let stringValue: string = "";

      switch (type) {
        case "text": // for text property -> copy the value
          stringValue = property.value;
          if (stringValue)
            contents.push(stringValue);
          break;
        case "rich_text": // for rich text -> strip HTML and copy the value
          stringValue = property.value.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\n/g, ' ');
          if (stringValue)
            contents.push(stringValue)
          // for rich text -> process linked content + components
          if (property.linkedItemCodenames && property.linkedItemCodenames.length > 0)
            linkedContent = [...linkedContent, ...this._getLinkedContent(property.linkedItemCodenames, [item.system.codename, ...parents], children, allContent)];
          break;
        case "modular_content": // for modular content -> process modular content
          if (property.itemCodenames && property.itemCodenames.length > 0)
            linkedContent = [...linkedContent, ...this._getLinkedContent(property.itemCodenames, [item.system.codename, ...parents], children, allContent)];
          break;
        //@TODO: case "custom_element": ... (searchable value)
      }
    }

    itemsContent.contents = contents.join(" ").replace('"', ''); // create one long string from contents
    return [itemsContent, ...linkedContent];
  }

  // creates a searchable structure (i.e. how the content should be structured for search) from obtained content
  createSearchableStructure(contentWithSlug: IContentItem[], allContent: IContentItem[]): SearchableItem[] {
    const searchableStructure: SearchableItem[] = [];

    // process all items with slug into searchable items
    for (const item of contentWithSlug) {
      const url = item.elements[this.config.slugCodename] as Elements.UrlSlugElement
      // searchable item structure
      let searchableItem: SearchableItem = {
          objectID: `${item.system.codename}_${item.system.language}`, 
          id: item.system.id,
          codename: item.system.codename,
          name: item.system.name,
          question: item.elements.question.value,
          answer: item.elements.answer.value,
          lastmodified: new Date(item.system.lastModified),
          type: item.elements.type.value,
          categories: item.elements.categories.value,        
          language: item.system.language,
          contenttype: item.system.type,
          collection: item.system.collection,
          slug: url.value,
          content: []
      };

      searchableItem.content = this.getContentFromItem(item, [], [], allContent,);
      searchableStructure.push(searchableItem);
    }

    return searchableStructure;
  }
}

export default KontentClient;

function getCamelCaseName(propName: string) {
  const adjusted = propName
  .toLowerCase()
  .replace(/[-_][a-z0-9]/g, (group) => group.slice(-1).toUpperCase())
  .replace(/_/g, '');

return adjusted.charAt(0).toLowerCase() + adjusted.slice(1)
}
