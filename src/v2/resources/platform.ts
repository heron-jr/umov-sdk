import { idOf, v2Action, v2Create, type V2CreateFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2Bool, V2IdRef, V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** Entrada de `media.upload` — vira multipart/form-data (`file`, `description`, `type`). */
export interface V2MediaUpload {
  file: Blob
  /** Nome enviado no multipart (default do runtime, ex.: `blob`). */
  filename?: string
  description?: string
  type?: string
}

/** `Data object para o registro de tags de mídia` — POST /media/tags. `hpiCodigo` e `tags` obrigatórios. */
export interface V2MediaTags {
  /** Identificador do histórico da mídia (hpi_codigo). */
  hpiCodigo: number
  /** Registro em midiatags (mit_codigo); se omitido usa `hpiCodigo`. */
  id?: number
  tags: Record<string, unknown>
}

/** `Data object de system parameters` — PATCH /systemParameters. */
export interface V2SystemParameters {
  /** Dias que uma atividade sem tarefa fica no mobile. */
  activityWithNoTaskDurationInDays?: number
  /** '0' sem proximidade · '1' mais próximos do local · '2' … */
  agentTaskSelection?: '0' | '1' | '2'
  /** Regra de associação agente × equipe ('0' sem restrições …). */
  agentTeamLink?: '0' | '1' | '2' | '3'
  alertNewScheduleOnMobile?: V2Bool
  /** Minutos entre sincronismos automáticos (0 desliga). */
  automaticSyncTime?: number
  backgroundSync?: V2Bool
  blockCalendarConflict?: V2Bool
  blockSimultaneousExecutionOnMobile?: V2Bool
  calculateDistanceByGps?: V2Bool
  canCreateTaskOnMobile?: V2Bool
  canEditRoute?: V2Bool
  canRouteOnMobile?: V2Bool
  canRouteWithGmaps?: V2Bool
  considerJourneyInRouting?: V2Bool
  /** Conteúdo das tarefas ('0' lista com texto e imagem grande …). */
  contentSchedule?: string
  dashboardExhibitionPeriod?: number
  /** Minutos para auto-refresh do dashboard (0 desliga). */
  dashboardRefreshInterval?: number
  dateTimeAutoAdjust?: V2Bool
  daysToViewFutureScheduleOnMobile?: number
  deleteHistoryMobile?: V2Bool
  disconsiderTimeWindowInRouting?: V2Bool
  displaysFirstTaskData?: V2Bool
  displaysWarningActivityPerformed?: V2Bool
  /** HERE | INTERNAL. */
  distanceMatrixProvider?: string
  /** '1' menos veículos · '2' menos tempo · '3' menos distância. */
  distributionType?: string
  doPhotoSyncInBackground?: V2Bool
  /** '0' execução livre · '1' segue prioridade · '2' … */
  executeTasksByPriority?: '0' | '1' | '2'
  exportGPSActivityUpdateFile?: V2Bool
  /** Campo (físico ou custom field) agrupador da tarefa. */
  fieldGroupsSchedule?: string
  filterReturnedOnField?: V2Bool
  filterUnexecuted?: V2Bool
  /** Forma de visualização das tarefas no mobile ('0' definido pelo usuário …). */
  formDisplaysSchedule?: string
  /** '0' por tarefa · '1' diária. */
  frequencyControlUnit?: '0' | '1'
  /** Timezone. */
  geoLocation?: string
  /** GOOGLE | HERE. */
  geoServicesProvider?: string
  /** GOOGLE | HERE. */
  geoServicesProviderRouting?: string
  /** Minutos de vida de uma geocoordenada coletada no mobile. */
  geocoordinatedLifeTime?: number
  geopositionAgentResolve?: V2Bool
  gpsAutomaticDistance?: number
  gpsMinAutomaticDistance?: number
  /** Segundos para coleta automática de GPS. */
  gpsTimeTracking?: number
  groupTaskPda?: 'GROUP_BY_ACTIVITY_TYPE' | 'GROUP_FIELD_TEN' | 'GROUP_TASK_DATE' | 'NO_GROUP'
  idiom?: V2Ref
  imageReportBigSize?: V2Bool
  infoTaskListField1?: string
  infoTaskListField2?: string
  infoTaskListField3?: string
  infoTaskListField4?: string
  /** Item padrão para seções de item único. */
  itemId?: number
  manuallyInsertGPS?: V2Bool
  maxGridRows?: number
  /** Precisão mínima tolerada (m) da coordenada capturada. */
  minPrecisionCoordinates?: number
  minimumCoordinateExecution?: number
  mobileTaskSearch?: string
  /** Comportamento do sync quando a data/hora do PDA diverge do servidor. */
  mustValidateDateTimePda?: number
  passwordPolicy?: V2Ref
  /** Horas de tolerância entre servidor e PDA. */
  pdaHourDelay?: string
  /** '1' descrição do local · '2' endereço · '3' observação · '4' data. */
  pdaTaskFormat?: '1' | '2' | '3' | '4'
  /** '1' descrição do local · '2' endereço · '3' observação · '4' … · '5' … */
  pdaTaskOrderFormat?: '1' | '2' | '3' | '4' | '5'
  /** '0' crescente · '1' decrescente. */
  pdaTaskOrderType?: '0' | '1'
  perimeterTaskRouting?: number
  /** '0' PNG · '1' JPG · '2' sem formato. */
  photoFormat?: '0' | '1' | '2'
  precisionProviderExecution?: string
  providerExecution?: string
  providerPrecision?: string
  providerTracking?: string
  /** '0' última posição GPS · '1' endereço do agente. */
  proximityCalculation?: '0' | '1'
  proximitySearchPerimeter?: number
  /** 0–100. */
  qualityPhoto?: number
  /** ANY (sem trânsito) | NOW (com trânsito). */
  routingDepartureMode?: string
  routingProcessDuplicateCoordinates?: string
  /** '0' lista · '1' abas. */
  scheduleGroupingType?: '0' | '1'
  /** '1' linear · '2' QRcode · '3' Datamatrix · '4' todos. */
  searchModeOnMobileSchedule?: '1' | '2' | '3' | '4'
  sendHistoryForCanceledSchedule?: V2Bool
  showGroupedByActivityTypeOnMobile?: V2Bool
  showIntegrationHistoryDetail?: V2Bool
  showPrintScheduleData?: V2Bool
  showTaskCounterMobile?: V2Bool
  /** '1' 256px · '2' 512px · '3' 1024px. */
  sizePhoto?: string
  smartPushIosAppId?: string
  storingLogMobile?: V2Bool
  /** '0' não obrigatório · '1' obrigatório · '2' obrigatório se tiver rede. */
  synchronismChangeEveryDay?: string
  /** Origem das atividades para novas tarefas ('1' agente · '2' local …). */
  taskSourceNewActivity?: '1' | '2' | '3' | '4' | '5' | '6' | '7'
  /** Milissegundos de timeout da requisição de posicionamento (0 sem timeout). */
  timeoutGPS?: number
  uniqueAlternativeIdentifier?: V2Bool
  uniqueNameAgent?: V2Bool
  /** '0' km · '1' milhas. */
  unitSystem?: '0' | '1'
  updateTaskDateTimeOnRouting?: V2Bool
  /** '0' sem controle de ciclos/frequências … */
  useFrequencyControlType?: '0' | '1' | '2'
  useItemsOnSchedule?: V2Bool
  useOnlyGoodGeoPrecision?: V2Bool
  usePrecisionDistanceCalculation?: V2Bool
  /** Carregamento das tarefas no roteirizador do mobile ('0' sem raio …). */
  useRoutingRadius?: '0' | '1' | '2' | '3'
  useTimeDistanceRouting?: V2Bool
  useVRPlanner?: V2Bool
  useVRPlannerInServiceLocal?: V2Bool
  validateAgentAvailabilityStaringSchedule?: V2Bool
}

/** `Data object para Aparência do sistema` — PATCH /appearances (white label). */
export interface V2Appearance {
  id?: number
  siteTitle?: string
  logoURL?: string
  favicon?: string
  backgroundImageURL?: string
  imageDimension?: 'BODY' | 'CENTER' | 'LAYOUT_CONTENT' | 'LEFT' | 'RIGHT'
  loginPositionType?: 'CENTER' | 'LEFT' | 'RIGHT'
  hideUmovMe?: V2Bool
  showFieldTypeIcon?: V2Bool
  backgroundColor?: string
  backgroundFormLoginColor?: string
  backgroundHeaderColor?: string
  backgroundMenuButtonsColor?: string
  primaryColor?: string
  secundaryColor?: string
  primaryTextColor?: string
  textFormLoginColor?: string
  primaryMenuTextColor?: string
  secundaryMenuTextColor?: string
  inactiveMenuTextColor?: string
  menuIconsColor?: 'BLACK' | 'WHITE'
  mobileBackgroundColor?: string
  mobileBackgroundImage?: string
  mobileButtonsColorSchemaCode?: string
  mobileFooterColor?: string
  mobileIconsColorSchemaCode?: string
  mobileLogoOne?: string
  mobileLogoTwo?: string
  mobilePrimaryColor?: string
  mobileSecundaryColor?: string
  mobileTertiaryColor?: string
  mobileTextColor?: string
}

export type V2FeatureToggleModule =
  | 'ALBIERI'
  | 'ANDROID'
  | 'APIV1'
  | 'APIV2_BUSINESS'
  | 'BOOK_FOTOS'
  | 'CABRAL'
  | 'CENTER'
  | 'GEOCODER'
  | 'IMPORTER'
  | 'IOS'
  | 'PAINEL_GESTAO'
  | 'REFILL'
  | 'ROUTING_MACHINE'
  | 'SCHEDULER'
  | 'SYNC'
  | 'UDASHBOARD'
  | 'UROUTING'
  | 'WATCHER'
  | 'ZEUS'

/**
 * `DTO para cadastro de feature toggle na plataforma umov.me` — POST /feature-toggle, PATCH /feature-toggle/{id}.
 * Na criação a spec marca `id, oldId, tag, description, sendToMobile, featureToggleModules` como obrigatórios.
 */
export interface V2FeatureToggle {
  /** Id da tabela csv de feature toggles. */
  id?: number
  oldId?: number
  /** TAG/nome usado nas aplicações. */
  tag?: string
  description?: string
  active?: V2Bool
  sendToMobile?: V2Bool
  featureToggleModules?: V2FeatureToggleModule[]
}

// ---------- Recursos ----------

export interface V2MediaResource {
  /** POST /media (multipart/form-data). */
  upload(input: V2MediaUpload): Promise<V2Result>
  tags: V2CreateFn<V2MediaTags>
}

export interface V2SystemParametersResource {
  /** PATCH /systemParameters — só os campos enviados. */
  patch(body: V2SystemParameters): Promise<V2Result>
}

export interface V2AppearancesResource {
  /** PATCH /appearances — só os campos enviados. */
  patch(body: V2Appearance): Promise<V2Result>
}

export interface V2FeatureTogglesResource {
  create: V2CreateFn<V2FeatureToggle>
  patch(ref: V2IdRef, body: V2FeatureToggle): Promise<V2Result>
  /** `/feature-toggle/{f}/client/{c}` */
  client: {
    add(featureId: number, clientId: number): Promise<V2Result>
    remove(featureId: number, clientId: number): Promise<V2Result>
  }
  /** `/feature-toggle/{f}/client/{c}/agent/{a}` */
  agent: {
    add(featureId: number, clientId: number, agentId: number): Promise<V2Result>
    remove(featureId: number, clientId: number, agentId: number): Promise<V2Result>
  }
  /** `/feature-toggle/{f}/global` */
  global: {
    add(featureId: number): Promise<V2Result>
    remove(featureId: number): Promise<V2Result>
  }
  /** `/feature-toggle/{f}/partner/{p}` */
  partner: {
    add(featureId: number, partnerId: number): Promise<V2Result>
    remove(featureId: number, partnerId: number): Promise<V2Result>
  }
}

export interface V2PlatformResources {
  media: V2MediaResource
  systemParameters: V2SystemParametersResource
  appearances: V2AppearancesResource
  featureToggles: V2FeatureTogglesResource
}

function toMediaFormData({ file, filename, description, type }: V2MediaUpload): FormData {
  const fd = new FormData()
  if (filename !== undefined) fd.append('file', file, filename)
  else fd.append('file', file)
  if (description !== undefined) fd.append('description', description)
  if (type !== undefined) fd.append('type', type)
  return fd
}

export function createPlatformResources(t: TransportV2): V2PlatformResources {
  const client = (f: number, c: number) => `feature-toggle/${f}/client/${c}`
  return {
    media: {
      upload: (input) => t.post('media', toMediaFormData(input)),
      tags: v2Action(t, 'POST', 'media/tags'),
    },
    systemParameters: {
      patch: (body) => t.patch('systemParameters', body),
    },
    appearances: {
      patch: (body) => t.patch('appearances', body),
    },
    featureToggles: {
      create: v2Create(t, 'feature-toggle'),
      patch: (ref, body) => t.patch(`feature-toggle/${idOf(ref)}`, body),
      client: {
        add: (f, c) => t.post(client(f, c)),
        remove: (f, c) => t.delete(client(f, c)),
      },
      agent: {
        add: (f, c, a) => t.post(`${client(f, c)}/agent/${a}`),
        remove: (f, c, a) => t.delete(`${client(f, c)}/agent/${a}`),
      },
      global: {
        add: (f) => t.post(`feature-toggle/${f}/global`),
        remove: (f) => t.delete(`feature-toggle/${f}/global`),
      },
      partner: {
        add: (f, p) => t.post(`feature-toggle/${f}/partner/${p}`),
        remove: (f, p) => t.delete(`feature-toggle/${f}/partner/${p}`),
      },
    },
  }
}
