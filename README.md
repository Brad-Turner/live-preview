# @contentful/live-preview

> **Warning:** This package is currently in an **ALPHA** state (i.e., not suitable for production use and subject to breaking changes).

Preview SDK for both the field tagging connection + live content updates by [Contentful](https://www.contentful.com/).

It uses [Typescript](https://www.typescriptlang.org/), [React](https://reactjs.org/) and is bundled using [Vite](https://vitejs.dev/guide/build.html#library-mode).

## Getting started

### Requirements

- Node.js: `>=16.15.1`

To install live preview simply run one of the following commands.

```bash
yarn add @contentful/live-preview
```

or

```bash
npm install @contentful/live-preview
```

## Documentation

### Initializing the SDK

To establish a communication between your preview frontend and Contentful, you simply need to initialize the live preview SDK. This can be done by executing the following command:

```jsx
import { ContentfulLivePreview } from '@contentful/live-preview';

...

ContentfulLivePreview.init();
```

### Field Tagging

To tag fields you need to add the live preview data-attributes to the rendered HTML element output.
You can do this in React via our helper function.
The necessary styles for the live edit tags can be found in the '@contentful/live-preview/style.css' file.

```jsx
import { ContentfulLivePreview } from '@contentful/live-preview';
import '@contentful/live-preview/style.css';
...

<h1 {...ContentfulLivePreview.getProps({ entryId: id, fieldId: 'title', locale })}>
  {title}
</h1>
```

### Live Updates

Live Updates from the editor to your applications are currently only directed supported for [React.js](https://reactjs.org/)

```tsx
import { useContentfulLiveUpdates } from "@contentful/live-preview/react";

// ...
const updated = useContentfulLiveUpdates(originalData, locale);
// ...
```

#### Integrating with Gatsby

To use the Contentful Live Preview SDK with Gatsby, you can start with the [gatsby starter contentful homepage](https://www.gatsbyjs.com/starters/gatsbyjs/gatsby-starter-contentful-homepage)

1. Add the @contentful/live-preview package to your Gatsby project by running one of the following commands:

```bash
yarn add @contentful/live-preview
```

or

```bash
npm install @contentful/live-preview
```

2. In your gatsby-browser.js file, import the live preview styles and initialize the SDK:

```tsx
import '@contentful/live-preview/dist/style.css';
import { ContentfulLivePreview } from '@contentful/live-preview';

ContentfulLivePreview.init();
```

3. In order to tag fields and use live updates, you need to add the contentful_id property to the GraphQL schema. For example, to extend the HomepageHero interface:

```graphql
interface HomepageHero implements Node & HomepageBlock {
  id: ID!
  contentful_id: String! # add this property
  heading: String!
  text: String
}

type ContentfulHomepageHero implements Node & HomepageHero & HomepageBlock @dontInfer {
  id: ID!
  contentful_id: String! # and also here
  heading: String!
  text: String
}
```

4. Update the corresponding component to load the contentful_id property:

```jsx
export const query = graphql`
  fragment HomepageHeroContent on HomepageHero {
    __typename
    id
    contentful_id # add this property
    heading
    text
  }
`;
```

5. Add tagging and live updates to your component:

```jsx
export default function Hero({ contentful_id, ...props }) {
  // Live updates for this component
  const data = useContentfulLiveUpdates(
    {
      ...props,
      sys: { id: props.contentful_id },
    },
    locale
  );

  return (
    <Section>
      <Heading as="h1">{data.heading}</Heading>
      {/* Text is tagged and can be clicked to open the editor */}
      <Text
        as="p"
        {...ContentfulLivePreview.getProps({
          entryId: contentful_id,
          fieldId: 'text',
          locale,
        })}>
        {data.text}
      </Text>
    </Section>
  );
}
```

6. In Contentful, define the preview environment and configure the preview URL for your Gatsby site. Once you open an entry with a configured preview URL, you can use the Live Preview and all its features.

That's it! You should now be able to use the Contentful Live Preview SDK with Gatsby.

## Code of Conduct

We want to provide a safe, inclusive, welcoming, and harassment-free space and experience for all participants, regardless of gender identity and expression, sexual orientation, disability, physical appearance, socioeconomic status, body size, ethnicity, nationality, level of experience, age, religion (or lack thereof), or other identity markers.

[Read our full Code of Conduct](https://github.com/contentful-developer-relations/community-code-of-conduct).

## License

The live preview package is open source software [licensed as MIT](./LICENSE).

[contentful]: https://www.contentful.com
[github-issues]: https://github.com/contentful/live-preview/issues
[typescript]: https://www.typescriptlang.org/
[react]: https://reactjs.org/
[prettier]: https://prettier.io/
[eslint]: https://eslint.org/
[vite]: https://vitejs.dev/
