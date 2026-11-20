// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_inicial.sql';
import m0001 from './0001_metas_vezes.sql';
import m0002 from './0002_tarefas_por_semana.sql';
import m0003 from './0003_metas_resultado_e_proposta.sql';
import m0004 from './0004_copia_de_seguranca.sql';
import m0005 from './0005_aparencia.sql';
import m0006 from './0006_idioma_e_dias.sql';
import m0007 from './0007_metas_concluidas.sql';
import m0008 from './0008_avisos_dos_blocos.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008
    }
  }
  