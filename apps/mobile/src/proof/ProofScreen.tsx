import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Oath } from '../api/oathSchema';
import { useArt } from '../art/ArtProvider';
import { SpriteFrame } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { bindShortWords } from '../localization/typography';
import { ruleIcon } from '../oaths/oathArt';
import { Action } from '../ui/Action';
import { BackLink } from '../ui/BackLink';
import { CompanionBubble } from '../ui/CompanionBubble';
import { layoutMode } from '../ui/layoutMode';
import { SceneSurface } from '../ui/SceneSurface';
import { Text } from '../ui/Text';
import { tokens } from '../ui/tokens';
import { captureImage, deleteLocalImage, type ProofSource } from './capture';
import type { ProofMode } from './proofClient';
import type { ProofController, ProofControllerError } from './proofController';

type Translate = (key: string) => string;
type Notice = { kind: 'denied'; canAskAgain: boolean } | { kind: 'unavailable' };
const routes: { mode: ProofMode; rule: 'photo' | 'activityRecord' }[] = [{ mode: 'photo', rule: 'photo' }, { mode: 'activity_record', rule: 'activityRecord' }];
// The server closed this Oath to proof. The player goes back to see its current state.
const closingCodes = new Set(['receipt_cutoff_passed', 'oath_not_active', 'proof_already_submitted']);
const imageCodes = new Set(['too_large', 'request_too_large', 'too_many_pixels']);
const unreadableCodes = new Set(['unsupported_type', 'unsupported_media_type', 'unreadable_image']);

/** Every failure reads as a plain sentence. None of them claims the server received anything. */
export function errorMessage(error: ProofControllerError, t: Translate): string {
  switch (error.kind) {
    case 'proof_refused':
      if (error.code === 'receipt_cutoff_passed') return t('proof.errors.receiptCutoffPassed');
      if (error.code === 'oath_not_active') return t('proof.errors.oathNotActive');
      if (error.code === 'proof_already_submitted') return t('proof.errors.alreadySubmitted');
      if (imageCodes.has(error.code)) return t('proof.errors.tooLarge');
      if (unreadableCodes.has(error.code)) return t('proof.errors.unreadable');
      return t('proof.errors.refused');
    case 'too_large': return t('proof.errors.tooLarge');
    case 'upload_rejected': return t('proof.errors.uploadRejected');
    case 'unavailable': return t('proof.errors.unavailable');
    case 'rate_limited': return t('proof.errors.rateLimited');
    case 'file_missing': return t('proof.errors.fileMissing');
    case 'storage': return t('proof.errors.storage');
    case 'reauthenticate': return t('proof.errors.reauthenticate');
    case 'proof_error': return t(error.code === 'character_required' ? 'proof.errors.characterRequired' : 'proof.errors.character');
    default: return t('proof.errors.sendFailed');
  }
}

/**
 * The proof form of one active Oath (MVP-07-T09): the route with its committed rule, one image from the camera or Photos,
 * the declaration from the Oath's own rules and the send action. The shared controller copies the normalized image and sends it.
 * Only the server's receipt moves the player on, through onDone with the Oath it returned.
 */
export function ProofScreen({ oath, controller, onDone, onBack, backLabel }: { oath: Oath; controller: ProofController; onDone(oath: Oath): void; onBack(): void; backLabel: string }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const ruleIcons = useArt().oaths.ruleIcons;
  const { width, fontScale } = useWindowDimensions();
  const simple = layoutMode(width, fontScale) === 'simple';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const copy = oath.snapshot.copy[locale];
  const text = (value: string) => bindShortWords(value, locale);
  const [mode, setMode] = useState<ProofMode | null>(null);
  const [image, setImage] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [declared, setDeclared] = useState(false);
  const [capturing, setCapturing] = useState<ProofSource | null>(null);
  const [notices, setNotices] = useState<Partial<Record<ProofSource, Notice>>>({});
  const [imageFailed, setImageFailed] = useState(false);
  // An answer left by another screen or an earlier proof is not news here. A new failure is a new object.
  const [quietError, setQuietError] = useState(() => (state.kind === 'ready' ? state.error : undefined));
  // The normalized JPEG this screen holds. It is deleted when replaced, when the controller has its own copy and on leaving.
  const imageFile = useRef<string | null>(null);
  function replaceImage(next: { uri: string; width: number; height: number } | null) {
    if (imageFile.current !== (next?.uri ?? null)) deleteLocalImage(imageFile.current);
    imageFile.current = next?.uri ?? null;
    setImage(next);
  }
  const mounted = useRef(true);
  // A send from this screen that has not settled. The controller copies the image in a queued step, so the file must outlive
  // a screen that closes meanwhile. Ownership passes to the send, which deletes it once settled.
  const sending = useRef<Promise<void> | null>(null);
  useEffect(() => {
    mounted.current = true;
    // After an effect re-run (StrictMode, Fast Refresh) the cleanup below already let the held file go.
    if (imageFile.current) { imageFile.current = null; setImage(null); }
    return () => {
      mounted.current = false;
      const uri = imageFile.current; const send = sending.current;
      if (send) void send.finally(() => deleteLocalImage(uri)); else deleteLocalImage(uri);
    };
  }, []);
  const done = useRef(false);
  const ready = state.kind === 'ready' ? state : null;
  // The controller serves every Oath of the character. Its answers concern the Oath of its pending proof, or the one this
  // screen sent. Answers about another Oath never close, clear or finish this form.
  const [subject, setSubject] = useState<string | null>(null);
  if (ready?.pending && subject !== ready.pending.oathId) setSubject(ready.pending.oathId);
  const ours = subject === oath.id;
  // The receipt for this Oath is the only way out as a success. A copy waiting on the device is not one.
  useEffect(() => {
    if (!done.current && ready && !ready.busy && !ready.pending && ready.oath?.id === oath.id) { done.current = true; onDone(ready.oath); }
  }, [ready, oath.id]);
  const error = ours && ready?.error && ready.error !== quietError ? ready.error : undefined;
  // A picture the controller lost or the server could not use must be chosen again.
  useEffect(() => {
    if (error && (error.kind === 'file_missing' || error.kind === 'too_large' || (error.kind === 'proof_refused' && !closingCodes.has(error.code)))) replaceImage(null);
  }, [error]);
  // Once the controller holds its own copy for this Oath, the screen's copy is no longer needed.
  const ownPending = ready?.pending?.oathId === oath.id;
  useEffect(() => { if (ownPending && imageFile.current) replaceImage(null); }, [ownPending]);

  async function choose(source: ProofSource) {
    if (capturing) return;
    setCapturing(source); setImageFailed(false);
    const result = await captureImage(source);
    setCapturing(null);
    if (!mounted.current) { if (result.kind === 'success') deleteLocalImage(result.uri); return; }
    if (result.kind === 'cancelled') return;
    if (result.kind === 'denied' || result.kind === 'unavailable') { setNotices(current => ({ ...current, [source]: result })); return; }
    setNotices(current => ({ ...current, [source]: undefined }));
    if (result.kind === 'failed') { setImageFailed(true); return; }
    replaceImage({ uri: result.uri, width: result.width, height: result.height });
    setQuietError(ready?.error);
  }
  const busy = !!ready?.busy;
  const missing = !mode ? 'route' : !image ? 'image' : !declared ? 'declaration' : null;
  function send() {
    if (!ready || busy || missing || !mode || !image) return;
    setSubject(oath.id);
    const send = controller.submit({ oathId: oath.id, mode, source: image.uri }).catch(() => {});
    sending.current = send;
    void send.finally(() => { if (sending.current === send) sending.current = null; });
  }

  function notice(source: ProofSource) {
    const shown = notices[source];
    if (!shown) return null;
    return <View testID={`proof-notice-${source}`} accessibilityLiveRegion="polite" style={styles.notice}>
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.noticeText}>{t(shown.kind === 'denied' ? (source === 'camera' ? 'proof.cameraDenied' : 'proof.libraryUnavailable') : `proof.${source}Unavailable`)}</Text>
      {shown.kind === 'denied' && !shown.canAskAgain
        && <Action label={t('proof.openSettings')} variant="secondary" onPress={() => { void Linking.openSettings().catch(() => {}); }} />}
    </View>;
  }

  const back = <BackLink label={backLabel} onPress={onBack} />;
  const head = <>
    <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('proof.submit')}</Text>
    <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.activity}>{copy.activity}</Text>
  </>;
  let body: ReactNode;
  if (oath.state !== 'active') body = <View accessibilityLiveRegion="polite"><CompanionBubble message={t('proof.notActive')} /></View>;
  else if (state.kind === 'storage_unavailable') body = <View accessibilityLiveRegion="polite"><CompanionBubble message={t('proof.storageUnavailable')} /></View>;
  else if (!ready) body = <Text accessibilityLiveRegion="polite" style={styles.body}>{t('proof.loading')}</Text>;
  else if (ready.pending && ready.pending.oathId !== oath.id) {
    // One unresolved proof per character blocks a new one. Its own Oath may no longer offer a proof screen, so sending it again
    // is offered here too. A replay is idempotent and its answers stay off this form. Only its own Oath offers delete.
    body = <View testID="proof-other-pending" style={styles.section}>
      <View accessibilityLiveRegion="polite"><CompanionBubble message={t('proof.otherPending')} /></View>
      {!busy && <Action label={t('proof.retry')} onPress={() => { void controller.recover(); }} />}
      <Action label={t('proof.back')} variant="secondary" direction="back" onPress={onBack} />
    </View>;
  } else if (ready.pending) {
    // One unresolved proof per character blocks a new one. Its copy can be sent again or given up.
    body = <View testID="proof-pending" style={styles.section}>
      <View accessibilityLiveRegion="polite"><CompanionBubble message={busy ? t(ready.deleting ? 'proof.deleting' : 'proof.sending') : ready.error ? errorMessage(ready.error, t) : t('proof.pending')} /></View>
      {/* While the upload runs, the bubble alone tells the player to wait. */}
      {!busy && <>
        <Action label={t('proof.retry')} onPress={() => { void controller.recover(); }} />
        <Action label={t('proof.discard')} variant="secondary" onPress={() => { void controller.discard(); }} />
      </>}
    </View>;
  } else if (error?.kind === 'proof_refused' && closingCodes.has(error.code)) {
    body = <View testID="proof-closed" style={styles.section}>
      <View accessibilityLiveRegion="polite"><CompanionBubble message={errorMessage(error, t)} /></View>
      <Action label={t('proof.back')} onPress={onBack} />
    </View>;
  } else {
    body = <>
      <CompanionBubble message={t('proof.intro')} />
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SpriteFrame sheet={ruleIcons} index={ruleIcon.proof} width={36} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{t('proof.routeHeading')}</Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('proof.routeHeading')} style={styles.routes}>
          {routes.map(route => {
            const selected = mode === route.mode;
            return <Pressable key={route.mode} testID={`proof-route-${route.mode}`} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }}
              accessibilityLabel={`${t(`proof.routes.${route.mode}.title`)}. ${t(`proof.routes.${route.mode}.hint`)}`} disabled={busy}
              // The label hides the texts inside, so VoiceOver reads the committed rule as the hint.
              accessibilityHint={copy.sections[route.rule]}
              onPress={() => setMode(route.mode)} style={({ pressed }) => [styles.route, selected && styles.selected, pressed && styles.pressed]}>
              <View style={styles.routeHead}>
                <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
                <View style={styles.routeTitles}>
                  <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.routeTitle}>{text(t(`proof.routes.${route.mode}.title`))}</Text>
                  <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.hint}>{text(t(`proof.routes.${route.mode}.hint`))}</Text>
                </View>
              </View>
              <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.rule}>{copy.sections[route.rule]}</Text>
            </Pressable>;
          })}
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{t('proof.imageHeading')}</Text>
        </View>
        <View style={styles.note}><Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.body}>{t('proof.crop')}</Text></View>
        {/* Side by side, both buttons take the taller one's height. Notices name their source, so they go under the pair. */}
        <View testID="proof-sources" style={[styles.sources, simple ? styles.stacked : styles.paired]}>
          {(['camera', 'library'] as const).map(source => <View key={source} style={simple ? styles.full : styles.half}>
            <Pressable accessibilityRole="button" accessibilityLabel={t(`proof.${source}`)} accessibilityState={{ disabled: busy || capturing !== null, busy: capturing === source }}
              disabled={busy || capturing !== null} onPress={() => { void choose(source); }} style={({ pressed }) => [styles.source, !simple && styles.sourceFill, pressed && styles.pressed]}>
              <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.sourceLabel}>{t(`proof.${source}`)}</Text>
            </Pressable>
            {simple && notice(source)}
          </View>)}
        </View>
        {!simple && notice('camera')}
        {!simple && notice('library')}
        {capturing && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('proof.preparing')}</Text>}
        {imageFailed && <View accessibilityLiveRegion="polite"><CompanionBubble message={t('proof.imageFailed')} /></View>}
        {image && <Image testID="proof-preview" accessibilityLabel={t('proof.preview')} accessibilityRole="image" accessible source={{ uri: image.uri }} resizeMode="contain"
          style={[styles.preview, { aspectRatio: image.width / image.height }]} />}
      </View>
      <View style={styles.declaration}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.declarationHeading}>{t('oath.rules.declaration')}</Text>
        <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.body}>{copy.declaration}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={t('proof.confirm')} accessibilityState={{ checked: declared, disabled: busy }} disabled={busy}
          onPress={() => setDeclared(value => !value)} style={({ pressed }) => [styles.check, pressed && styles.pressed]}>
          <View style={[styles.box, declared && styles.boxOn]}>{declared && <Text allowFontScaling={false} style={styles.tick}>✓</Text>}</View>
          <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.checkLabel}>{t('proof.confirm')}</Text>
        </Pressable>
      </View>
      <View style={styles.note}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.noteHeading}>{t('proof.caveatHeading')}</Text>
        <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.body}>{t('proof.caveat')}</Text>
      </View>
      {(busy || error) && <View accessibilityLiveRegion="polite"><CompanionBubble message={busy ? t('proof.sending') : errorMessage(error!, t)} /></View>}
      {missing
        ? <Action label={t('proof.submit')} onPress={send} disabled unavailableReason={t(`proof.missing.${missing}`)} />
        : <Action label={t('proof.submit')} onPress={send} busy={busy} />}
    </>;
  }
  return <SceneSurface place="seals"><SafeAreaView style={styles.safeArea}>
    <ScrollView testID="proof-scroll" contentContainerStyle={styles.content}>{back}{head}{body}</ScrollView>
  </SafeAreaView></SceneSurface>;
}
const panel = { borderRadius: 16, backgroundColor: 'rgba(28, 22, 16, 0.94)', borderWidth: 1, borderColor: '#5b4630' } as const;
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: tokens.space.card, paddingTop: 24, paddingBottom: 36, gap: tokens.space.section },
  title: { color: '#f3dfbd', fontFamily: tokens.font.display, fontSize: tokens.title, lineHeight: 36, textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  activity: { color: tokens.color.primary, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 2.4, textTransform: 'uppercase', marginTop: -16 },
  section: { gap: 12 },
  // The seal wall behind the form is busy, so each heading sits on a plaque like the cards below it.
  sectionHead: { ...panel, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 6, paddingHorizontal: 14 },
  heading: { flexShrink: 1, color: '#f3dfbd', fontFamily: tokens.font.display, fontSize: 21, lineHeight: 29, textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  routes: { gap: 10 },
  route: { ...panel, gap: 10, padding: 14, borderWidth: 2 },
  selected: { borderColor: '#e0a84f', backgroundColor: 'rgba(73, 56, 33, 0.96)' },
  pressed: { opacity: 0.8 },
  routeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#a7834c', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: tokens.color.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: tokens.color.primary },
  routeTitles: { flex: 1, gap: 2 },
  routeTitle: { color: tokens.color.text, fontSize: tokens.body, lineHeight: 24, fontWeight: '700' },
  hint: { color: tokens.color.secondary, fontSize: 15, lineHeight: 21 },
  rule: { color: '#ded1bd', fontSize: 15, lineHeight: 22 },
  note: { ...panel, gap: 6, padding: 14 },
  noteHeading: { color: tokens.color.primary, fontSize: 15, fontWeight: '700' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  sources: { gap: 10 },
  paired: { flexDirection: 'row', alignItems: 'stretch' },
  stacked: { flexDirection: 'column' },
  half: { flex: 1, gap: 8 },
  full: { alignSelf: 'stretch', gap: 8 },
  sourceFill: { flexGrow: 1 },
  source: { minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: '#8a6436', backgroundColor: 'rgba(32, 25, 19, 0.96)', alignItems: 'center', justifyContent: 'center' },
  sourceLabel: { color: '#f4deb7', fontSize: tokens.body, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  notice: { gap: 4 },
  noticeText: { color: tokens.color.missed, fontSize: 15, lineHeight: 22 },
  preview: { width: '100%', maxHeight: 360, borderRadius: 12, backgroundColor: '#0d0b09' },
  declaration: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: 'rgba(32, 25, 19, 0.94)', borderLeftWidth: 3, borderLeftColor: tokens.color.primary },
  declarationHeading: { color: tokens.color.primary, fontSize: 15, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  box: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#a7834c', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  tick: { color: tokens.color.canvas, fontSize: 18, fontWeight: '700' },
  checkLabel: { flex: 1, color: tokens.color.text, fontSize: tokens.body, lineHeight: 24, fontWeight: '600' },
});
