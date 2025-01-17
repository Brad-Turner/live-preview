import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import type {
  AssetProps,
  EntryProps,
  KeyValueMap,
  SysLink,
  WithResourceName,
} from 'contentful-management';

import { MAX_DEPTH } from '../constants';
import { debug, clone, isPrimitiveField, resolveReference, updatePrimitiveField } from '../helpers';
import { ContentType, EntityReferenceMap, isAsset } from '../types';

type Reference = AssetProps | EntryProps | WithResourceName<EntryProps>;

/**
 * Resolves the correct field name from the ContentType
 * (Asset needs the ID as it is an internal type)
 */
function getFieldName(contentType: ContentType, field: ContentType['fields'][number]): string {
  if (contentType.name === 'Asset') {
    return field.id;
  }

  return field.apiName || field.name;
}

/**
 * Update the reference from the entry editor with the information from the entityReferenceMap.
 * If the information is not yet available, it send a message to the editor to retrieve it.
 */
async function updateRef(
  dataFromPreviewApp: Reference | undefined,
  updateFromEntryEditor: Reference | SysLink,
  locale: string,
  entityReferenceMap: EntityReferenceMap,
  depth: number,
  visitedReferences: Set<string>
): Promise<Reference | undefined | null> {
  let reference;
  // If the ID of the updateFromEntryEditor is in visitedReferences, then stop the recursion
  if (visitedReferences.has(updateFromEntryEditor.sys.id)) {
    debug.warn('Detected a circular reference, stopping recursion');
    reference = entityReferenceMap.get(
      'urn' in updateFromEntryEditor.sys
        ? updateFromEntryEditor.sys.urn
        : updateFromEntryEditor.sys.id
    );
  } else {
    visitedReferences.add(
      'urn' in updateFromEntryEditor.sys
        ? updateFromEntryEditor.sys.urn
        : updateFromEntryEditor.sys.id
    );
    const { reference: resolvedReference } = await resolveReference({
      entityReferenceMap,
      referenceId: updateFromEntryEditor.sys.id,
      ...(isAsset(updateFromEntryEditor as EntryProps) ? { isAsset: true } : undefined),
      locale,
    });
    reference = resolvedReference;
  }

  if (!reference) {
    return dataFromPreviewApp;
  }

  // Entity is already in the reference map, so let's apply it on the data
  const result = clone(reference);

  //@TODO -- Refactor so we check based on field types instead of field value https://contentful.atlassian.net/browse/TOL-1285
  for (const key in reference.fields) {
    const value = reference.fields[key as keyof typeof reference.fields][locale];

    //single ref fields
    if (
      typeof value === 'object' &&
      value?.sys &&
      value.sys.type !== 'ResourceLink' &&
      depth < MAX_DEPTH
    ) {
      await updateSingleRefField(
        result,
        reference,
        locale,
        key as keyof Reference['fields'],
        entityReferenceMap,
        depth + 1,
        visitedReferences
      );
      //multi ref fields
    } else if (
      Array.isArray(value) &&
      value[0]?.sys &&
      value[0].sys.type !== 'ResourceLink' &&
      depth < MAX_DEPTH
    ) {
      await updateMultiRefField(
        result,
        reference,
        locale,
        key as keyof Reference['fields'],
        entityReferenceMap,
        depth + 1,
        visitedReferences
      );
      //rich text fields
    } else if (value.content && value.nodeType === 'document') {
      await updateRichTextField(
        result as EntryProps,
        reference,
        key,
        locale,
        entityReferenceMap,
        depth + 1,
        visitedReferences
      );
      //single resource link fields
    } else if (typeof value === 'object' && value?.sys && value.sys.type === 'ResourceLink') {
      //@TODO -- add live updates for resource links inside of references
      debug.warn('Detected a resource link, support is still under development.');
      return result;
      //multi resource link fields
    } else if (Array.isArray(value) && value[0]?.sys && value[0].sys.type === 'ResourceLink') {
      //@TODO -- add live updates for resource links inside of references
      debug.warn('Detected a resource link, support is still under development.');
      return result;
      //primitive fields
    } else {
      updatePrimitiveField({
        dataFromPreviewApp: result.fields,
        updateFromEntryEditor: reference,
        name: key,
        locale,
      });
    }
  }

  return result;
}

/** Update multi reference fields, resolves deeper nested references and fields */
async function updateMultiRefField(
  dataFromPreviewApp: Reference,
  updateFromEntryEditor: Reference,
  locale: string,
  name: keyof Reference['fields'],
  entityReferenceMap: EntityReferenceMap,
  depth: number,
  visitedReferences: Set<string>
) {
  if (!updateFromEntryEditor.fields?.[name]?.[locale]) {
    delete dataFromPreviewApp.fields[name];
    return;
  }

  dataFromPreviewApp.fields[name] = await Promise.all(
    updateFromEntryEditor.fields[name][locale].map(
      (updateFromEntryReference: Reference, index: number) =>
        updateRef(
          dataFromPreviewApp.fields[name]?.[index],
          updateFromEntryReference,
          locale,
          entityReferenceMap,
          depth + 1,
          visitedReferences
        )
    )
  ).then((list) => list.filter(Boolean));

  return dataFromPreviewApp;
}

/** Update a single reference field, resolves also deeper references */
async function updateSingleRefField(
  dataFromPreviewApp: Reference,
  updateFromEntryEditor: Reference,
  locale: string,
  name: keyof Reference['fields'],
  entityReferenceMap: EntityReferenceMap,
  depth: number,
  visitedReferences: Set<string>
) {
  const matchUpdateFromEntryEditor = updateFromEntryEditor?.fields?.[name]?.[locale];

  // If it does no longer exist, remove it from the preview data
  if (!matchUpdateFromEntryEditor) {
    delete dataFromPreviewApp.fields[name];
    return;
  }

  // otherwise update it with the new reference
  dataFromPreviewApp.fields[name] = await updateRef(
    dataFromPreviewApp.fields[name],
    matchUpdateFromEntryEditor,
    locale,
    entityReferenceMap,
    depth + 1,
    visitedReferences
  );

  return dataFromPreviewApp;
}

async function resolveRichTextLinks(
  node: any,
  entityReferenceMap: EntityReferenceMap,
  locale: string,
  depth: number,
  visitedReferences: Set<string>
) {
  //@TODO -- add live updates embedded resource links in rich text
  if (
    node.nodeType === BLOCKS.EMBEDDED_ENTRY ||
    node.nodeType === BLOCKS.EMBEDDED_ASSET ||
    node.nodeType === INLINES.EMBEDDED_ENTRY ||
    node.nodeType === INLINES.ENTRY_HYPERLINK ||
    node.nodeType === INLINES.ASSET_HYPERLINK
  ) {
    if (node.data && node.data.target && node.data.target.sys) {
      const id = node.data.target?.sys.id || '';
      const updatedReference = {
        sys: { id: id, type: 'Link', linkType: node.data.target.sys.linkType },
      };
      if (node.data.target.sys.linkType === 'Entry' || node.data.target.sys.linkType === 'Asset') {
        node.data.target = await updateRef(
          undefined,
          updatedReference,
          locale,
          entityReferenceMap,
          depth + 1,
          visitedReferences
        );
      }
    }
  }
  if (node.content) {
    for (const childNode of node.content) {
      await resolveRichTextLinks(
        childNode,
        entityReferenceMap,
        locale,
        depth + 1,
        visitedReferences
      );
    }
  }
}

async function updateRichTextField(
  dataFromPreviewApp: EntryProps,
  updateFromEntryEditor: EntryProps | AssetProps,
  name: string,
  locale: string,
  entityReferenceMap: EntityReferenceMap,
  depth: number,
  visitedReferences: Set<string>
) {
  const richText = (updateFromEntryEditor.fields as KeyValueMap | undefined)?.[name]?.[locale];

  if (richText && richText.nodeType === 'document') {
    // Update the rich text JSON data
    dataFromPreviewApp.fields[name] = richText;
    // Resolve the linked entries or assets within the rich text field
    for (const node of richText.content) {
      await resolveRichTextLinks(node, entityReferenceMap, locale, depth, visitedReferences);
    }
  }
}

/**
 * Updates REST response data based on CMA entry object
 *
 * @param contentType
 * @param dataFromPreviewApp The REST response to be updated
 * @param updateFromEntryEditor CMA entry object containing the update
 * @param locale Locale code
 * @returns Updated REST response data
 */
export async function updateEntity(
  contentType: ContentType,
  dataFromPreviewApp: EntryProps,
  updateFromEntryEditor: EntryProps | AssetProps,
  locale: string,
  entityReferenceMap: EntityReferenceMap,
  depth: number,
  visitedReferences: Set<string>
): Promise<EntryProps> {
  if (dataFromPreviewApp.sys.id !== updateFromEntryEditor.sys.id) {
    return dataFromPreviewApp;
  }

  for (const field of contentType.fields) {
    const name = getFieldName(contentType, field);

    if (isPrimitiveField(field) || field.type === 'File') {
      updatePrimitiveField({
        dataFromPreviewApp: dataFromPreviewApp.fields,
        updateFromEntryEditor,
        name,
        locale,
      });
    } else if (field.type === 'Link' && depth < MAX_DEPTH) {
      await updateSingleRefField(
        dataFromPreviewApp,
        updateFromEntryEditor,
        locale,
        name as keyof Reference['fields'],
        entityReferenceMap,
        depth + 1,
        visitedReferences
      );
    } else if (field.type === 'Array' && field.items?.type === 'Link' && depth < MAX_DEPTH) {
      await updateMultiRefField(
        dataFromPreviewApp,
        updateFromEntryEditor,
        locale,
        name as keyof Reference['fields'],
        entityReferenceMap,
        depth + 1,
        visitedReferences
      );
    } else if (field.type === 'RichText') {
      await updateRichTextField(
        dataFromPreviewApp,
        updateFromEntryEditor,
        name,
        locale,
        entityReferenceMap,
        depth,
        visitedReferences
      );
    } else if (field.type === 'ResourceLink') {
      //@TODO -- add live updates for resource links
      debug.warn('Detected a resource link, support is still under development.');
      return dataFromPreviewApp;
    }
  }

  return dataFromPreviewApp;
}
