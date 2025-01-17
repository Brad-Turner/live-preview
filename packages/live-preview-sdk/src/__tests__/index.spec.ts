// @vitest-environment jsdom
import { describe, it, expect, vi, Mock, afterEach, beforeAll } from 'vitest';

import { sendMessageToEditor, isInsideIframe } from '../helpers';
import { ContentfulLivePreview } from '../index';
import { InspectorMode } from '../inspectorMode';
import { LiveUpdates } from '../liveUpdates';
import { TagAttributes } from '../types';

vi.mock('../inspectorMode');
vi.mock('../liveUpdates');
vi.mock('../helpers');

describe('ContentfulLivePreview', () => {
  const receiveMessageTagging = vi.fn();
  const receiveMessageUpdates = vi.fn();
  const subscribe = vi.fn();

  (InspectorMode as Mock).mockImplementation(() => ({
    receiveMessage: receiveMessageTagging,
  }));
  (LiveUpdates as Mock).mockImplementation(() => ({
    receiveMessage: receiveMessageUpdates,
    subscribe,
  }));

  beforeAll(() => {
    (isInsideIframe as Mock).mockReturnValue(true);

    ContentfulLivePreview.init({ locale: 'en-US' });
    // establish the connection, needs to tested here, as we can only init the ContentfulLivePreview once
    expect(sendMessageToEditor).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    describe('should bind the message listeners', () => {
      it('provide the data to InspectorMode and LiveUpdates', () => {
        const data = { from: 'live-preview', value: 'any' };
        window.dispatchEvent(new MessageEvent('message', { data }));

        expect(receiveMessageTagging).toHaveBeenCalledTimes(1);
        expect(receiveMessageTagging).toHaveBeenCalledWith(data);
        expect(receiveMessageUpdates).toHaveBeenCalledTimes(1);
        expect(receiveMessageUpdates).toHaveBeenCalledWith(data);
      });

      it('doenst call the InspectorMode and LiveUpdates for invalid events', () => {
        // Not from live-preview
        window.dispatchEvent(
          new MessageEvent('message', { data: { from: 'anywhere', value: 'any' } })
        );

        // Invalid data
        window.dispatchEvent(new MessageEvent('message', { data: 'just a string' }));
        window.dispatchEvent(new MessageEvent('message', { data: null }));

        expect(receiveMessageTagging).not.toHaveBeenCalled();
        expect(receiveMessageUpdates).not.toHaveBeenCalled();
      });
    });
  });

  describe('subscribe', () => {
    it('should subscribe to changes from LiveUpdates', () => {
      const callback = vi.fn();
      const data = { entity: {} };
      ContentfulLivePreview.subscribe({ data, locale: 'en-US', callback });

      // Check that the LiveUpdates.subscribe was called correctly
      expect(subscribe).toHaveBeenCalledOnce();
      expect(subscribe).toHaveBeenCalledWith({ data, locale: 'en-US', callback });

      // Updates from the subscribe fn will trigger the callback
      subscribe.mock.lastCall?.[0].callback({ entity: { title: 'Hello' } });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ entity: { title: 'Hello' } });
    });

    it('should not subscribe to changes if it is disabled', () => {
      ContentfulLivePreview.toggleLiveUpdatesMode();

      const callback = vi.fn();
      const data = { entity: {} };
      ContentfulLivePreview.subscribe({ data, locale: 'en-US', callback });

      // Check that the LiveUpdates.subscribe was called correctly
      expect(subscribe).not.toHaveBeenCalled();
    });
  });

  describe('getProps', () => {
    it('returns the expected props with a given entryId, fieldId and locale', () => {
      const entryId = 'test-entry-id';
      const fieldId = 'test-field-id';
      const locale = 'test-locale';

      const result = ContentfulLivePreview.getProps({
        entryId,
        fieldId,
        locale,
      });

      expect(result).toStrictEqual({
        [TagAttributes.FIELD_ID]: fieldId,
        [TagAttributes.ENTRY_ID]: entryId,
        [TagAttributes.LOCALE]: locale,
      });
    });

    it('returns null if it is disabled', () => {
      ContentfulLivePreview.toggleInspectorMode();

      const entryId = 'test-entry-id';
      const fieldId = 'test-field-id';
      const locale = 'test-locale';

      const result = ContentfulLivePreview.getProps({
        entryId,
        fieldId,
        locale,
      });

      expect(result).toBeNull();
    });
  });
});
