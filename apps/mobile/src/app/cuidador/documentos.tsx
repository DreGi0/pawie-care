import {
  getCaregiverMeGetQueryKey,
  useCaregiverMeGet,
  useCaregiverMeUpdate,
  type CaregiverDocumentKind,
  type FileResponse,
} from '@pawie/api-client';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Row } from '@/components/Row';
import { Sheet } from '@/components/Sheet';
import { Status } from '@/components/Status';
import { Text } from '@/components/Text';
import { errorMessage, queryClient } from '@/lib/api';
import { DOCUMENTS } from '@/lib/caregivers';
import { isDemo, isWeb } from '@/lib/config';
import { uploadFile } from '@/lib/files';
import { colors, radius, space } from '@/theme/tokens';

type Document = (typeof DOCUMENTS)[number];
type Source = 'camera' | 'library' | 'pdf';

const SOURCES: Record<Source, { label: string; icon: IconName }> = {
  camera: { label: 'Tomar foto', icon: 'camera' },
  // In a browser both are the same file chooser.
  library: { label: isWeb ? 'Elegir archivo' : 'Elegir de la galería', icon: 'image' },
  pdf: { label: isWeb ? 'Elegir archivo' : 'Elegir un PDF', icon: 'file-text' },
};

/**
 * Where each document can come from. The selfie is taken at the moment, with the front camera.
 * The browser has no reliable camera permission, so there it's always "Elegir archivo": the
 * chooser of PDFs and photos for the background check, and the one of images for the rest.
 */
function sourcesOf(kind: CaregiverDocumentKind): Source[] {
  if (isWeb) return [kind === 'BACKGROUND_CHECK' ? 'pdf' : 'library'];
  if (kind === 'SELFIE') return ['camera'];
  if (kind === 'BACKGROUND_CHECK') return ['camera', 'library', 'pdf'];
  return ['camera', 'library'];
}

class PermissionDenied extends Error {}

/** A photo or a PDF from the phone, or null if the person cancelled. */
async function pick(source: Source, kind: CaregiverDocumentKind) {
  if (source === 'pdf') {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      // Its copy in the cache lands outside what expo-file-system may read in Expo Go; the
      // content:// URI of the original reads fine.
      copyToCacheDirectory: false,
    });
    const asset = result.assets?.[0];
    return result.canceled || !asset
      ? null
      : { uri: asset.uri, mimeType: asset.mimeType ?? 'application/pdf' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionDenied();
    result = await ImagePicker.launchCameraAsync({
      ...options,
      cameraType: kind === 'SELFIE' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.assets?.[0];
  return result.canceled || !asset
    ? null
    : { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}

// CuiDocumentos (RN-CUI-01, RN-CUI-03): each document is saved as soon as it's uploaded, and
// can be replaced until Pawie approves the sign-up.
export default function DocumentsScreen() {
  const profile = useCaregiverMeGet();
  const update = useCaregiverMeUpdate();
  const [choosing, setChoosing] = useState<Document | null>(null);
  const [uploading, setUploading] = useState<CaregiverDocumentKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documents = new Map(profile.data?.documents.map(({ kind, file }) => [kind, file]));
  const verified = profile.data?.status === 'APPROVED';
  const complete = DOCUMENTS.every(({ kind }) => documents.has(kind));

  const upload = async (document: Document, source: Source) => {
    setChoosing(null);
    setError(null);
    try {
      const asset = await pick(source, document.kind);
      if (!asset) return;
      setUploading(document.kind);
      const fileId = await uploadFile(asset.uri, asset.mimeType, document.purpose);
      const saved = await update.mutateAsync({
        data: { documents: [{ kind: document.kind, fileId }] },
      });
      queryClient.setQueryData(getCaregiverMeGetQueryKey(), saved);
    } catch (caught) {
      setError(
        caught instanceof PermissionDenied
          ? 'Para tomar la foto, permite que Pawie use la cámara en los ajustes del teléfono.'
          : errorMessage(caught),
      );
    } finally {
      setUploading(null);
    }
  };

  const choose = (document: Document) => {
    const sources = sourcesOf(document.kind);
    if (sources.length === 1) void upload(document, sources[0]);
    else setChoosing(document);
  };

  return (
    <FormScreen
      title="Tus documentos"
      subtitle="Con ellos verificamos tu identidad y tus antecedentes, para que los dueños confíen en ti."
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
      footer={
        // Once the four are in, the review starts by itself: this only takes the caregiver back,
        // and it shows without scrolling on any phone.
        complete &&
        !verified && (
          <BottomBar>
            <Button label="Listo" onPress={() => router.back()} />
          </BottomBar>
        )
      }
    >
      {profile.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : profile.isError ? (
        <Banner tone="error" message={errorMessage(profile.error)} />
      ) : (
        <>
          {isDemo && (
            <Banner
              tone="warning"
              message="No subas documentos reales. Esto es una demo: usa fotos o archivos de prueba."
            />
          )}
          {verified ? (
            <Banner
              tone="success"
              message="Tus documentos están verificados. Ya tienes las insignias Identidad verificada y Antecedentes verificados."
            />
          ) : complete ? (
            <Banner
              tone="info"
              message="Ya están todos. El equipo de Pawie los revisa para aprobar tu alta."
            />
          ) : (
            <Banner
              tone="info"
              icon="lock"
              message="Solo los ve el equipo de Pawie. Nunca se muestran a los dueños."
            />
          )}

          <View>
            {DOCUMENTS.map((document, index) => (
              <DocumentRow
                key={document.kind}
                document={document}
                file={documents.get(document.kind)}
                verified={verified}
                uploading={uploading === document.kind}
                divider={index > 0}
                onPress={verified || uploading ? undefined : () => choose(document)}
              />
            ))}
          </View>

          {error && <Banner tone="error" message={error} />}
        </>
      )}

      <Sheet
        visible={choosing !== null}
        onClose={() => setChoosing(null)}
        title={choosing?.title ?? ''}
      >
        <View>
          {choosing &&
            sourcesOf(choosing.kind).map((source, index) => (
              <Row key={source} divider={index > 0} onPress={() => upload(choosing, source)}>
                <Icon name={SOURCES[source].icon} />
                <Text variant="subheading" style={styles.flex}>
                  {SOURCES[source].label}
                </Text>
              </Row>
            ))}
        </View>
      </Sheet>
    </FormScreen>
  );
}

function DocumentRow({
  document,
  file,
  verified,
  uploading,
  divider,
  onPress,
}: {
  document: Document;
  file: FileResponse | undefined;
  verified: boolean;
  uploading: boolean;
  divider: boolean;
  onPress?: () => void;
}) {
  const state = uploading ? 'Subiendo' : !file ? 'Falta' : verified ? 'Verificado' : 'Subido';

  return (
    <Row divider={divider} onPress={onPress} accessibilityLabel={`${document.title}, ${state}`}>
      <Preview document={document} file={file} />
      <View style={styles.flex}>
        <Text variant="subheading">{document.title}</Text>
        <Text variant="caption" color="inkMuted">
          {document.detail}
        </Text>
        <View style={styles.state}>
          {uploading ? (
            <View style={styles.uploading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text variant="caption">Subiendo…</Text>
            </View>
          ) : (
            <Status tone={file ? 'success' : 'warning'} label={state} />
          )}
        </View>
      </View>
      {onPress && <Icon name={file ? 'rotate-cw' : 'plus'} color="inkMuted" />}
    </Row>
  );
}

/** The photo itself, or the document's icon for a PDF or while it's missing. */
function Preview({ document, file }: { document: Document; file: FileResponse | undefined }) {
  if (file?.url && file.contentType.startsWith('image/')) {
    return (
      <Image
        source={{ uri: file.url }}
        style={styles.preview}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.preview, styles.previewIcon]}>
      <Icon name={file ? 'file-text' : document.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: space[8] },
  state: { marginTop: space[1] },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  preview: { width: 56, height: 56, borderRadius: radius.sm },
  previewIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tint },
});
