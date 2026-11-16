import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormularioTarefa } from '@/components/FormularioTarefa';
import { useSemanaAtual } from '@/estado/semana';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function NovaTarefaEcra() {
  const { areaId, metaId, semana } = useLocalSearchParams<{ areaId?: string; metaId?: string; semana?: string }>();
  const semanaAtual = useSemanaAtual();
  const router = useRouter();
  const area = Number(areaId);
  const meta = Number(metaId);

  return (
    <FormularioTarefa
      semana={semana && DATA_ISO.test(semana) ? semana : semanaAtual}
      areaInicial={Number.isInteger(area) && area > 0 ? area : undefined}
      metaInicial={Number.isInteger(meta) && meta > 0 ? meta : undefined}
      aoFechar={() => router.back()}
    />
  );
}
