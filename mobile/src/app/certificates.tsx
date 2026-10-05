import { View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { C } from '@/constants/theme'
import { fmtDay } from '@/lib/format'
import { useCertificates } from '@/lib/queries'
import { Card, Empty, ErrorBox, Icon, Loading, Screen, T } from '@/components/ui'

export default function CertificatesScreen() {
  const certs = useCertificates()
  return (
    <Screen edges={[]} refreshing={certs.isRefetching} onRefresh={() => void certs.refetch()}>
      {certs.isLoading ? <Loading /> : certs.error ? <ErrorBox error={certs.error} onRetry={() => void certs.refetch()} /> :
        certs.data!.length === 0 ? <Empty icon={{ ios: 'rosette', android: 'workspace_premium' }} title="No certificates yet" hint="Certificates from events you attend show up here." /> :
          certs.data!.map(c => (
            <Card key={c.id} onPress={() => void WebBrowser.openBrowserAsync(c.verifyUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon ios="rosette" android="workspace_premium" size={24} color={C.violet} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={2}>{c.event.title}</T>
                <T v="small">{c.type === 'participation' ? 'Participation' : c.type} · {fmtDay(c.issuedAt)}{c.event.club ? ` · ${c.event.club}` : ''}</T>
                <T v="small" style={{ color: C.textDim }}>ID {c.id}</T>
              </View>
              <Icon ios="arrow.up.right" android="open_in_new" size={16} color={C.textMuted} />
            </Card>
          ))}
    </Screen>
  )
}
