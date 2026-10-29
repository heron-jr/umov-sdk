import type { EntityRef } from '../../core/types'
import { formatDate } from '../../util/datetime'
import {
  assertSameRefKind,
  idOf,
  isAltRef,
  refToV2Path,
  refValue,
  v2Action,
  v2Create,
  v2Delete,
  v2Patch,
  type V2CreateFn,
  type V2DeleteFn,
  type V2WriteFn,
} from '../resource'
import type { TransportV2 } from '../transport'
import type { V2Bool, V2DateInput, V2IdRef, V2Image, V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `Contrato referente à entidade Activity no umov.me` — POST /activities, PATCH /activities/{ref}. */
export interface V2Activity {
  description?: string
  alternativeIdentifier?: string
  active?: V2Bool
  /** Vigência (yyyy-MM-dd). */
  initialEffectiveDate?: V2DateInput
  finalEffectiveDate?: V2DateInput
  displayOrder?: number
  documentation?: string
  image?: V2Image
  itinerarySchedule?: V2Ref
  locked?: V2Bool
  /** Regras adicionais (JSON serializado). */
  additionalRules?: string
  /** Regras de retroalimentação (JSON array serializado em string). */
  retroAlimentationRule?: string
  acceleratedExecution?: V2Bool
  allowHistorySearch?: V2Bool
  /** '0' todas as impeditivas impedem · '1' uma já impede. */
  ancestorActivityImpeditiveType?: string
  ancestorActivityType?: 'ALL_ANCESTOR_ACTIVITY' | 'AT_LEAST_ONE_ANCESTOR_ACTIVITY'
  batchExecution?:
    | 'BATCH_EXECUTION_ALLOWING_THE_CHOICE_OF_TASKS_OF_THE_SAME_GROUP'
    | 'BATCH_EXECUTION_FOR_ALL_TASKS_THE_SAME_GROUP'
    | 'BATCH_EXECUTION_NOT_ALLOWED'
  cancelAssured?: V2Bool
  captureGPS?: V2Bool
  gpsisMandatory?: V2Bool
  confirmWithoutGPS?: V2Bool
  communicationType?: 'ASK_USER' | 'MANDATORY_SYNCHRONIZE' | 'NOT_SYNCHRONIZE' | 'SYNCHRONIZE'
  confirmClose?: 'NO' | 'YES' | 'YES_AND_SHOW_DATA_FOR_CHECKING' | 'YES_AND_SHOW_NOT_COLLECTED_ITEMS'
  considerOnJourney?: V2Bool
  controlFrequencyInCycle?: V2Bool
  minimalExecutionInCycle?: number
  maximumExecutionInCycle?: number
  displayConferenceScreen?: V2Bool
  endMessage?: string
  exclusive?: V2Bool
  executionControl?: V2Bool
  executionOnlineOnly?: V2Bool
  executionType?: 'FINISH_ACTIVITY' | 'FINISH_SCHEDULE' | 'KEEP_ON_PDA' | 'VALIDATION_FORMULA'
  loopExecution?: V2Bool
  maySuspendExecution?: V2Bool
  negativeExecution?: V2Bool
  radiusOfExecution?: number
  /** Dias da semana em que pode ser executada. */
  monday?: V2Bool
  tuesday?: V2Bool
  wednesday?: V2Bool
  thursday?: V2Bool
  friday?: V2Bool
  saturday?: V2Bool
  sunday?: V2Bool
  takePictures?: V2Bool
  takeAudio?: V2Bool
  minimumAmountPics?: number
  maximumAmountPics?: number
  /** `1@Dica da foto 1;3@Dica da foto 3;` */
  pictureTip?: string
  reportsExecutionDate?: V2Bool
  /** '0' não informa · '1' informa data · '2' informa data e hora. */
  reportsMobExecutionDate?: string
  sharingWays?: 'NOT_SHARING_EXECUTION' | 'SHARE_DATA_BY_PUBLIC_LINK' | 'SHARE_DATA_OTHER_APPS_UMOVME' | 'SHARE_IMAGE_OTHER_APPS_MOBILE'
  showCancellationMsg?: 'NO' | 'YES'
  showsSessionWebForm?: V2Bool
  sideMenu?: V2Bool
  sideMenuMandatory?: V2Bool
  messageSideMenu?: string
  structural?: 'AUTOMATIC' | 'MANUAL'
  functionStructural?: string
  wayExecution?: V2Bool
  workJourney?: 'BREAK_END' | 'BREAK_START' | 'IGNORE_USER_DISPONIBILITY' | 'JOURNEY_END' | 'JOURNEY_START' | 'VALIDATE_USER_DISPONIBILITY'
  insertModule?: string
  updatedModule?: string
}

/** `Contrato referente à entidade Section no uMov.me` — /activities/{ref}/sections. */
export interface V2Section {
  description?: string
  alternativeIdentifier?: string
  active?: V2Bool
  order?: number
  documentation?: string
  image?: V2Image
  locked?: V2Bool
  /** Vínculo com a atividade (alternativas: `activityId`/`activityAlternativeIdentifier`). */
  activity?: V2Ref
  activityId?: number
  activityAlternativeIdentifier?: string
  sectionId?: number
  sectionAlternativeIdentifier?: string
  /** Para migração/atualização. */
  oldSectionId?: number
  oldSectionAlternativeIdentifier?: string
  ancestorSection?: V2Ref
  activityHistoryReportType?: 'HORIZONTAL' | 'VERTICAL'
  allowChangeViewMobile?: V2Bool
  allowDuplicateItems?: V2Bool
  audibleAlert?: 'NEVER_SEND_ALERT_TO_MAKE_SEARCH' | 'SENDING_ALERT_WHEN_ITEM_DIDNT_FIND'
  autoExecUniqueItemSearch?: V2Bool
  automaticItemAdvance?: V2Bool
  automaticSectionAdvance?: V2Bool
  cleanFilterSearchItem?: V2Bool
  defaultSection?: V2Bool
  displayItemsInMobile?: 'ITEMS_SECTION' | 'ITEMS_SUGGESTED_BY_GATHERING' | 'ITEMS_TASK_SERVICE_LOCAL'
  displaySection?: V2Bool
  displaySingleItem?: V2Bool
  executionWayItem?: 'SEARCH_AND_SELECTION' | 'SEARCH_BAR_CODE' | 'SEARCH_ONLY' | 'SEARCH_ONLY_EXECUTION'
  finalizationIconSection?: 'DEFAULT' | 'ECOMMERCE'
  findItemsByIdentifier?:
    | 'DESCRIPTION_CONTAINS'
    | 'IDENTIFIER_CONTAINS'
    | 'IDENTIFIER_DESCRIPTION_FIELD'
    | 'IDENTIFIER_EXACT_ONLY'
    | 'IDENTIFIER_EXACT_THEN_DESCRIPTION'
  focusOnFirstEditableField?: V2Bool
  groupingItemsTypeOnMobile?: 'ALL' | 'NO_GROUPING' | 'ONLY_SUBGROUP'
  hideGroupSubgroupWithoutItems?: V2Bool
  itemFillMode?: 'ALL_ITEMS_REQUIRED' | 'FREE' | 'UNIQUE'
  mandatory?: 'MANDATORY' | 'OPTIONAL' | 'OPTIONAL_WITH_ALERT'
  markCompleteGroup?: 'NOT_SIGNAL' | 'SIGNAL_ALL_ITENS' | 'SIGNAL_SUBGROUP'
  mobileItemViewWay?: 'GRID' | 'LIST' | 'MOBILE_COMMERCE'
  numberFieldsQuiz?: number
  quizMode?: V2Bool
  orderItem?: 'FORMULA_ORDER' | 'ITEM_DESCRIPTION'
  orderItemReport?: V2Bool
  paymentForm?: V2Bool
  saveCardData?: V2Bool
  searchModeItemsOnMobile?: 'FULL_TEXT' | 'LIKE'
  seeItemsCollectedAutomatically?: 'FILTER_COLLECTED_ITEMS' | 'NOT_FILTER_COLLECTED_ITEMS' | 'ONLY_COLLECTED_ITEMS'
  showSectionItemImage?: V2Bool
  structural?: V2Bool
  structuralFunction?: string
  toggleItems?: V2Bool
  typeReadSearchItem?: 'ALL_OPTIONS' | 'DATA_MATRIX' | 'LINEAR_BARCODE' | 'NO_READING' | 'NO_READ_SEARCH' | 'QR_CODE' | 'USER_DEFINED_MOBILE'
  useItem?:
    | 'ALL_ITEMS'
    | 'FIXED_MIX'
    | 'LOCAL_ACTIVITY_MIX'
    | 'LOCAL_MIX'
    | 'LOCATION_TYPE_MIX'
    | 'PERSON_MIX'
    | 'SELECTED_ITEMS'
    | 'SUBGROUP_ITEMS'
  useItemIdsCache?: V2Bool
}

export type V2SectionFieldType =
  | 'ADDRESS'
  | 'ALPHANUMERIC'
  | 'AUDIO'
  | 'BOOLEAN'
  | 'DATE'
  | 'DOCUMENT'
  | 'GEOCOORDINATE'
  | 'IMAGE'
  | 'LABEL'
  | 'LINEAR_DISTANCE'
  | 'LIST'
  | 'MULTIMEDIA'
  | 'NUMERIC'
  | 'PAYMENT_RECEIVER'
  | 'QUALIFICATION'
  | 'READER_ALPHANUMERIC'
  | 'READER_NUMERIC'
  | 'SECTION'
  | 'TIME'
  | 'TIMER'
  | 'VIDEO'
  | 'WEBVIEW'

export type V2SectionFieldDataEntry =
  | 'BARCODE_CAMERA'
  | 'BARCODE_OR_QRCODE_CAMERA_OR_EXTERNAL'
  | 'BARCODE_OR_QRCODE_OR_DATAMATRIX_CAMERA'
  | 'DRAW'
  | 'GALLERY'
  | 'MANUAL'
  | 'MANUAL_OR_BARCODE'
  | 'MANUAL_OR_BARCODE_OR_QRCODE_OR_DATAMATRIX'
  | 'MANUAL_OR_NFC'
  | 'MANUAL_OR_QRCODE_CAMERA'
  | 'MANUAL_WITH_STEPPER'
  | 'PHOTO'
  | 'PHOTO_AND_GALLERY'
  | 'QRCODE_CAMERA'
  | 'SIGNATURE'
  | 'TIMER_AUTOMATIC'
  | 'TIMER_MANUAL'

/** `Contrato referente à entidade SectionField no uMov.me` — /activities/{ref}/sections/{ref}/fields. */
export interface V2SectionField {
  /** Só no PATCH. */
  id?: number
  description?: string
  label?: string
  alternativeIdentifier?: string
  oldSectionFieldAlternativeIdentifier?: string
  active?: V2Bool
  order?: number
  documentation?: string
  fieldType?: V2SectionFieldType
  subType?: 'AUDIO' | 'EXTERNAL_CONNECTOR' | 'HTML' | 'IMAGE' | 'IMAGE_CAROUSEL' | 'PDF' | 'URL' | 'VIDEO' | 'XML'
  /** Alias legado de `subType`. */
  multimediaType?: string
  /** Vínculo com atividade/seção (alternativas: ids e identificadores alternativos). */
  activity?: V2Ref
  activityId?: number
  activityAlternativeIdentifier?: string
  section?: V2Ref
  sectionId?: number
  sectionAlternativeIdentifier?: string
  /** Referência a outra seção (`fieldType: 'SECTION'`). */
  sectionReferenceId?: number
  additionalRules?: string
  configurations?: string
  payloadRequest?: string
  connectorId?: number
  customEntityId?: number
  customEntityFieldInternalValue?: string
  customEntityFieldExternalValue?: string
  customEntityOrderField?: 'EXTERNAL' | 'INTERNAL'
  customFieldReferenceId?: number
  decimal?: number
  roundNumber?: V2Bool
  minsize?: number
  maxsize?: number
  mask?: 'BR_CURRENCY' | 'CNPJ' | 'CPF' | 'DECIMAL' | 'LOWERCASE_MASK' | 'PASSWORD' | 'PHONE' | 'UPPERCASE_MASK' | 'US_CURRENCY' | 'WITHOUT_MASK'
  monetaryPrefix?: string
  trueValue?: string
  falseValue?: string
  executeAtItemsScreen?: V2Bool
  fontFormat?: 'BOLD' | 'ITALIC' | 'REGULAR'
  fontSize?: 'LARGE' | 'MEDIUM' | 'SMALL'
  hideEmptyField?: V2Bool
  listItems?: string[]
  listType?: 'MULTIPLE' | 'RANKING' | 'UNIQUE'
  sourceValue?: 'CONNECTOR' | 'MANUAL' | 'USING_CUSTOM_ENTITY' | 'USING_ENTITY_LIST_FIELD' | 'USING_ENTITY_MULTI_VALUED_FIELD'
  noneOfThePrevious?: V2Bool
  randomOrder?: V2Bool
  showMultipleCheckList?: V2Bool
  locked?: V2Bool
  mandatory?: V2Bool
  nullable?: V2Bool
  validateOnlyVisible?: V2Bool
  visible?: V2Bool
  mobilePageNumber?: string
  screenIndex?: number
  persistent?: V2Bool
  processFormListItens?: V2Bool
  share?: V2Bool
  showDataCollected?: V2Bool
  showDataCollectedCenter?: 'ALWAYS_SHOW' | 'DO_NOT_DISPLAY' | 'ONLY_DISPLAY_WHEN_LOGGED_IN' | 'ONLY_SHOW_WHEN_PUBLIC'
  showValueInMobile?: 'DO_NOT_SHOW' | 'SHOW_COLLECTED' | 'SHOW_PREVIEW' | 'SHOW_RESULT_BY_FORMULA'
  structural?: V2Bool
  typeOfDataEntry?: V2SectionFieldDataEntry
  unique?: V2Bool
  uniqueField?: 'NOT_UNIQUE' | 'UNIQUE_IN_FIELD' | 'UNIQUE_IN_SECTION'
  updatable?: V2Bool
  urlViewType?: 'BROWSER' | 'WEBVIEW'
}

/** `Contrato para cópia de atividade` — POST /activities/copy. Origem por `activityId` ou `activityAlternativeIdentifier`. */
export interface V2ActivityCopy {
  newDescription: string
  activityId?: number
  activityAlternativeIdentifier?: string
  /** Ambiente de destino; default é o do token. */
  targetClientId?: number
}

/** `Contrato para criação de atividade padrão` — POST|DELETE /activities/default. */
export interface V2DefaultActivity {
  activityId?: number
  alternativeIdentifier?: string
}

/** `Relacionamento de atividade antecessora/impeditiva` — informe `activityId` ou `alternativeIdentifier`. */
export interface V2ActivityRelation {
  activityId?: number
  alternativeIdentifier?: string
}

export type V2TaskListInfo = 'CORPARATE_NAME' | 'DESCRIPTION_LOCAL' | 'LOCATION_ADDRESS' | 'OBSERVATION' | 'SCHEDULE_TYPE' | 'START_DATE_TIME'

/** `Contrato referente ao tipo de atividade no umov.me` — description obrigatório. */
export interface V2ActivityType {
  description?: string
  alternativeIdentifier?: string
  active?: V2Bool
  displayOrder?: number
  observation?: string
  image?: V2Image
  locked?: V2Bool
  originCode?: number
  calculateDistanceTraveled?: V2Bool
  cancelPreviousDay?: V2Bool
  contentSchedule?: string
  formDisplaysSchedule?: string
  pdaTaskOrderFormat?: string
  wayToDisplayActivities?: string
  infoTaskListField1?: V2TaskListInfo
  infoTaskListField2?: V2TaskListInfo
  infoTaskListField3?: V2TaskListInfo
  infoTaskListField4?: V2TaskListInfo
  rotable?: V2Bool
  showMap?: V2Bool
  showScheduleAndServiceLocalInformation?: V2Bool
  showSearch?: V2Bool
  showTask?: V2Bool
  structural?: V2Bool
  structuralFunction?: string
  viewScheduleCount?: V2Bool
}

/** `ExpressionElementDTO` — elemento da expressão de uma fórmula. */
export interface V2ExpressionElement {
  label?: string
  order?: number
  type?: string
  value?: string
}

/** `FormulaDTO` — /formulas/valor/{tipo} e /formulas/validacao/{tipo}. */
export interface V2Formula {
  active?: boolean
  activityId?: number
  sectionId?: number
  sectionFieldId?: number
  expression?: V2ExpressionElement[]
  clearAllFields?: boolean
  convertEmptyValuesToZero?: boolean
  documentation?: string
  emitBeep?: boolean
  execFormulaHistory?: boolean
  executeExpressionVisibleField?: boolean
  falseResultMode?: number
  moment?: number
  operationResultType?: string
  ordination?: number
  validationMessage?: string
}

// ---------- Recursos ----------

/** `/activities/{id}/ancestors` e `/impediments` — só id na spec. */
export interface V2ActivityRelationsResource {
  /** PUT — substitui a lista inteira. */
  replace(activityRef: V2IdRef, relations: V2ActivityRelation[]): Promise<V2Result>
  /** PATCH — adiciona um relacionamento. */
  add(activityRef: V2IdRef, relation: V2ActivityRelation): Promise<V2Result>
  /** DELETE `/{relatedActivityId}`. */
  remove(activityRef: V2IdRef, relatedActivityId: number): Promise<V2Result>
}

export interface V2SectionLinkResource {
  add(activityRef: EntityRef, sectionRef: EntityRef, ref: EntityRef): Promise<V2Result>
  remove(activityRef: EntityRef, sectionRef: EntityRef, ref: EntityRef): Promise<V2Result>
}

export interface V2SectionsResource {
  /** POST `/activities/{id}/sections` — só id na spec. */
  create(activityRef: V2IdRef, body: V2Section): Promise<V2Result>
  /** PATCH `/activities/{id}/sections/{id}` ou `/activities/alt-id/{a}/sections/{secAlt}` (seção sem `alt-id/`). */
  patch(activityRef: EntityRef, sectionRef: EntityRef, body: V2Section): Promise<V2Result>
  fields: {
    /** POST `…/sections/{ref}/fields`. */
    create(activityRef: EntityRef, sectionRef: EntityRef, body: V2SectionField): Promise<V2Result>
    /** PATCH `…/sections/{id}/fields/{id}` ou `…/sections/alt-id/{s}/field/{fAlt}` (singular, sem `alt-id/`). */
    patch(activityRef: EntityRef, sectionRef: EntityRef, fieldRef: EntityRef, body: V2SectionField): Promise<V2Result>
  }
  /** `…/sections/{ref}/items/{ref}` */
  items: V2SectionLinkResource
  /** `…/sections/{ref}/subgroups/{ref}` */
  subGroups: V2SectionLinkResource
}

export interface V2ActivitiesResource {
  create: V2CreateFn<V2Activity>
  patch: V2WriteFn<V2Activity>
  /** DELETE `/activities/alt-id/{alt}` — a spec só expõe por altId. */
  remove(altId: string): Promise<V2Result>
  copy: V2CreateFn<V2ActivityCopy>
  /** POST `/activities/default`. */
  setDefault: V2CreateFn<V2DefaultActivity>
  /** DELETE `/activities/default` (com body). */
  unsetDefault: V2CreateFn<V2DefaultActivity>
  ancestors: V2ActivityRelationsResource
  impediments: V2ActivityRelationsResource
  sections: V2SectionsResource
}

export interface V2ActivityTypesResource {
  create: V2CreateFn<V2ActivityType>
  patch: V2WriteFn<V2ActivityType>
  remove: V2DeleteFn
}

/** `/formulas/{valor|validacao}/{tipo}` — `tipo` é o segmento livre da rota. */
export interface V2FormulaKindResource {
  create(tipo: string, body: V2Formula): Promise<V2Result>
  patch(tipo: string, formulaRef: V2IdRef, body: V2Formula): Promise<V2Result>
  remove(tipo: string, formulaRef: V2IdRef): Promise<V2Result>
}

export interface V2FormulasResource {
  value: V2FormulaKindResource
  validation: V2FormulaKindResource
}

export interface V2ActivityResources {
  activities: V2ActivitiesResource
  activityTypes: V2ActivityTypesResource
  formulas: V2FormulasResource
}

function normalizeActivity(a: V2Activity): V2Activity {
  const out = { ...a }
  if (out.initialEffectiveDate !== undefined) out.initialEffectiveDate = formatDate(out.initialEffectiveDate)
  if (out.finalEffectiveDate !== undefined) out.finalEffectiveDate = formatDate(out.finalEffectiveDate)
  return out
}

export function createActivityResources(t: TransportV2): V2ActivityResources {
  const relations = (sub: 'ancestors' | 'impediments'): V2ActivityRelationsResource => ({
    replace: (ref, list) => t.put(`activities/${idOf(ref)}/${sub}`, list),
    add: (ref, item) => t.patch(`activities/${idOf(ref)}/${sub}`, item),
    remove: (ref, relatedId) => t.delete(`activities/${idOf(ref)}/${sub}/${relatedId}`),
  })

  // `/activities/{ref}/sections/{ref}` — forma regular (ambos com `alt-id/` quando altId)
  const sectionPath = (act: EntityRef, sec: EntityRef) => {
    assertSameRefKind(act, sec, 'activities/sections')
    return `activities/${refToV2Path(act)}/sections/${refToV2Path(sec)}`
  }
  const sectionLink = (sub: 'items' | 'subgroups'): V2SectionLinkResource => {
    const path = (act: EntityRef, sec: EntityRef, ref: EntityRef) => {
      assertSameRefKind(sec, ref, `activities/sections/${sub}`)
      return `${sectionPath(act, sec)}/${sub}/${refToV2Path(ref)}`
    }
    // async para que a validação de refs rejeite a promise em vez de lançar síncrono
    return {
      add: async (act, sec, ref) => t.post(path(act, sec, ref)),
      remove: async (act, sec, ref) => t.delete(path(act, sec, ref)),
    }
  }

  const formulaKind = (kind: 'valor' | 'validacao'): V2FormulaKindResource => ({
    create: (tipo, body) => t.post(`formulas/${kind}/${encodeURIComponent(tipo)}`, body),
    patch: (tipo, ref, body) => t.patch(`formulas/${kind}/${encodeURIComponent(tipo)}/${idOf(ref)}`, body),
    remove: (tipo, ref) => t.delete(`formulas/${kind}/${encodeURIComponent(tipo)}/${idOf(ref)}`),
  })

  return {
    activities: {
      create: v2Create(t, 'activities', normalizeActivity),
      patch: v2Patch(t, 'activities', normalizeActivity),
      remove: (altId) => t.delete(`activities/${refToV2Path({ altId })}`),
      copy: v2Action(t, 'POST', 'activities/copy'),
      setDefault: v2Action(t, 'POST', 'activities/default'),
      unsetDefault: v2Action(t, 'DELETE', 'activities/default'),
      ancestors: relations('ancestors'),
      impediments: relations('impediments'),
      sections: {
        create: (act, body) => t.post(`activities/${idOf(act)}/sections`, body),
        // caso especial: por altId a seção vai SEM o prefixo `alt-id/`
        patch: async (act, sec, body) => {
          assertSameRefKind(act, sec, 'activities/sections')
          return t.patch(`activities/${refToV2Path(act)}/sections/${encodeURIComponent(refValue(sec))}`, body)
        },
        fields: {
          create: async (act, sec, body) => t.post(`${sectionPath(act, sec)}/fields`, body),
          // caso especial: por altId é `field/{fAlt}` (singular, sem `alt-id/`); por id é `fields/{id}`
          patch: async (act, sec, field, body) => {
            assertSameRefKind(sec, field, 'activities/sections/fields')
            const tail = isAltRef(field) ? `field/${encodeURIComponent(refValue(field))}` : `fields/${refValue(field)}`
            return t.patch(`${sectionPath(act, sec)}/${tail}`, body)
          },
        },
        items: sectionLink('items'),
        subGroups: sectionLink('subgroups'),
      },
    },
    activityTypes: {
      create: v2Create(t, 'activityType'),
      patch: v2Patch(t, 'activityType'),
      remove: v2Delete(t, 'activityType'),
    },
    formulas: {
      value: formulaKind('valor'),
      validation: formulaKind('validacao'),
    },
  }
}
