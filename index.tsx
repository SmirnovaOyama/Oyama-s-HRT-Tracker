
import React, { useState, useEffect, useMemo, createContext, useContext, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { v4 as uuidv4 } from 'uuid';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts';
import {
    Plus, Trash2, Syringe, Pill, Droplet, Sticker, X, 
    Settings, ChevronDown, ChevronUp, Save, Clock, Languages, Calendar,
    Activity, Info, ZoomIn, RotateCcw, Download, Upload, QrCode, Camera, Image as ImageIcon, Copy, Github, Lock
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import jsQR from 'jsqr';
import {
    DoseEvent, Route, Ester, ExtraKey, SimulationResult,
    runSimulation, interpolateConcentration, getToE2Factor, EsterInfo, SublingualTierParams, CorePK, SL_TIER_ORDER,
    getBioavailabilityMultiplier, encryptData, decryptData, GEL_SITE_ORDER, GelSiteParams
} from './logic.ts';

const APP_VERSION = "Stable 1.1.1";

// --- Localization ---

type Lang = 'zh' | 'zh-TW' | 'yue' | 'en' | 'ru' | 'uk';

const TRANSLATIONS_BASE = {
    zh: {
        "app.title": "HRT 记录",
        "nav.home": "概览",
        "nav.history": "记录",
        "nav.settings": "设置",
        "status.estimate": "当前估算浓度",
        "status.weight": "体重",
        "chart.title": "雌二醇浓度 (pg/mL)",
        "chart.tooltip.conc": "浓度",
        "chart.tooltip.time": "时间",
        "chart.now": "现在",
        "chart.reset": "重置缩放",
        "timeline.title": "用药记录",
        "timeline.empty": "暂无记录",
        "timeline.delete_confirm": "确定删除这条记录吗？",
        "timeline.dose_label": "剂量",
        "timeline.bio_label": "剂量",
        "drawer.title": "实用工具",
        "drawer.clear": "清空所有剂量",
        "drawer.clear_confirm": "删除所有记录？不可撤销。",
        "drawer.save": "保存剂量 JSON",
        "drawer.save_hint": "下载 JSON 备份。",
        "drawer.import": "导入剂量 JSON",
        "drawer.import_hint": "导入 JSON 并覆盖。",
        "drawer.github": "GitHub 仓库",
        "drawer.github_desc": "查看源代码与反馈。",
        "drawer.empty_export": "当前没有可保存的剂量记录。",
        "drawer.import_error": "导入失败，请确认文件内容有效。",
        "drawer.import_success": "导入成功，已更新剂量记录。",
        "drawer.close": "关闭侧栏",
        "drawer.qr": "二维码导入导出",
        "drawer.qr_hint": "二维码分享或恢复。",
        "import.title": "导入数据",
        "import.text": "粘贴 JSON 文本",
        "import.paste_hint": "在此处粘贴 JSON 内容...",
        "import.file": "选择 JSON 文件",
        "import.file_btn": "选择文件",
        "qr.title": "二维码导入导出",
        "qr.export.title": "导出剂量到二维码",
        "qr.export.empty": "当前没有可导出的剂量记录。",
        "qr.copy": "复制 JSON",
        "qr.copied": "已复制",
        "qr.copy_hint": "也可以直接复制 JSON 文本进行分享。",
        "qr.import.title": "二维码导入",
        "qr.import.file": "上传二维码图片",
        "qr.import.scan": "开启摄像头扫描",
        "qr.import.stop": "停止扫描",
        "qr.scan.hint": "请将二维码置于取景框中央。",
        "qr.scan.active": "摄像头已开启，请对准二维码。",
        "qr.upload.hint": "支持 PNG/JPEG 等常见格式。",
        "qr.error.camera": "无法访问摄像头。",
        "qr.error.decode": "未检测到有效二维码。",
        "qr.error.format": "二维码内容无效。",
        "qr.help": "含个人数据，谨慎分享。",
        "error.nonPositive": "不能输入小于等于0的值",
        
        "export.encrypt_ask": "是否加密导出？",
        "export.encrypt_ask_desc": "加密后将生成随机密码，导入时必须输入该密码。",
        "export.password_title": "文件加密密码",
        "export.password_desc": "请妥善保存此密码，导入该文件时需要使用。",
        "import.password_title": "输入密码",
        "import.password_desc": "检测到加密数据，请输入密码解密。",
        "import.decrypt_error": "解密失败，密码错误或数据损坏。",
        "qr.encrypt_label": "加密",

        "btn.add": "新增给药",
        "btn.save": "保存",
        "btn.cancel": "取消",
        "btn.edit": "编辑",
        "btn.ok": "确定",
        "btn.copy": "复制",

        "dialog.confirm_title": "确认",
        "dialog.alert_title": "提示",

        "modal.weight.title": "设置体重",
        "modal.weight.desc": "用于估算浓度峰值。",
        "modal.dose.add_title": "新增用药",
        "modal.dose.edit_title": "编辑用药",

        "field.time": "给药时间",
        "field.route": "给药途径",
        "field.ester": "药物种类",
        "field.dose_raw": "药物剂量 (mg)",
        "field.dose_e2": "等效 E2 (mg)",
        "field.patch_mode": "输入模式",
        "field.patch_rate": "释放速率 (µg/天)",
        "field.patch_total": "总剂量 (mg)",
        "field.sl_duration": "含服时长 (分钟)",
        "field.sl_custom": "自定义 θ",
        "field.gel_site": "涂抹位置",
        
        "sl.instructions": "少吞咽，含住药液直至目标时间。",
        "sl.mode.quick": "快速 (2m)",
        "sl.mode.casual": "随意 (5m)",
        "sl.mode.standard": "标准 (10m)",
        "sl.mode.strict": "严格 (15m)",
        
        "route.injection": "肌注 (Injection)",
        "route.oral": "口服 (Oral)",
        "route.sublingual": "舌下 (Sublingual)",
        "route.gel": "凝胶 (Beta)",
        "gel.site.arm": "手臂 (Arm)",
        "gel.site.thigh": "大腿 (Thigh)",
        "gel.site.scrotal": "阴囊 (Scrotal)",
        "beta.gel": "Beta：凝胶生物利用率数据有限，数值为近似估计。",
        "gel.site_disabled": "涂抹部位选择仍在开发中，当前暂不可用。",
        "beta.patch": "Beta：贴片参数为近似值，请记录贴上与移除时间。",
        "beta.patch_remove": "记录移除时间即可，剂量会自动按贴片佩戴时长计算。",
        "route.patchApply": "贴片贴上 (Beta)",
        "route.patchRemove": "贴片移除 (Beta)",

        "ester.E2": "雌二醇 (E2)",
        "ester.EV": "戊酸雌二醇 (EV)",
        "ester.EB": "苯甲酸雌二醇 (EB)",
        "ester.EC": "环戊丙酸雌二醇 (EC)",
        "ester.EN": "庚酸雌二醇 (EN)",
        "drawer.lang": "语言设置",
        "drawer.lang_hint": "切换界面显示语言。",
        "drawer.model_title": "底层模型详解",
        "drawer.model_desc": "了解估算背后的药代动力学模型。",
        "drawer.model_confirm": "即将访问第三方网站 (misaka23323.com)，是否继续？",
        "drawer.github_confirm": "即将访问第三方网站 (github.com)，是否继续？",
        
        "settings.group.general": "常规设置",
        "settings.group.data": "数据管理",
        "settings.group.about": "关于",
        "settings.version": "版本号",
    },
    en: {
        "app.title": "HRT Recorder",
        "nav.home": "Overview",
        "nav.history": "History",
        "nav.settings": "Settings",
        "status.estimate": "Current Estimate",
        "status.weight": "Weight",
        "chart.title": "E2 Graph (pg/mL)",
        "chart.tooltip.conc": "Conc.",
        "chart.tooltip.time": "Time",
        "chart.now": "NOW",
        "chart.reset": "Reset Zoom",
        "timeline.title": "Dose History",
        "timeline.empty": "No records yet.",
        "timeline.delete_confirm": "Are you sure you want to delete this record?",
        "timeline.dose_label": "Dose",
        "timeline.bio_label": "Dose",
        "drawer.title": "Utilities",
        "drawer.clear": "Clear All Dosages",
        "drawer.clear_confirm": "Clear all? Irreversible.",
        "drawer.save": "Save Dosages (JSON)",
        "drawer.save_hint": "Download JSON backup.",
        "drawer.import": "Import Dosages (JSON)",
        "drawer.import_hint": "Import JSON & overwrite.",
        "drawer.github": "GitHub Repository",
        "drawer.github_desc": "View source code & feedback.",
        "drawer.empty_export": "There are no dosages to export yet.",
        "drawer.import_error": "Import failed. Please check that the file is valid.",
        "drawer.import_success": "Imported dosages successfully.",
        "drawer.close": "Close Panel",
        "drawer.qr": "QR Import/Export",
        "drawer.qr_hint": "Share or restore via QR.",
        "import.title": "Import Data",
        "import.text": "Paste JSON Text",
        "import.paste_hint": "Paste JSON content here...",
        "import.file": "Select JSON File",
        "import.file_btn": "Choose File",
        "qr.title": "QR Import & Export",
        "qr.export.title": "Export doses to QR",
        "qr.export.empty": "Add at least one dose to generate a QR code.",
        "qr.copy": "Copy JSON",
        "qr.copied": "Copied",
        "qr.copy_hint": "You can also share the raw JSON text.",
        "qr.import.title": "Import from QR",
        "qr.import.file": "Upload QR image",
        "qr.import.scan": "Start camera scan",
        "qr.import.stop": "Stop scanning",
        "qr.scan.hint": "Align the QR code inside the frame.",
        "qr.scan.active": "Camera live. Point the QR into the frame.",
        "qr.upload.hint": "PNG/JPEG screenshots are supported.",
        "qr.error.camera": "Camera access failed.",
        "qr.error.decode": "No valid QR detected.",
        "qr.error.format": "QR payload is invalid.",
        "qr.help": "Contains dosage data. Share carefully.",
        "error.nonPositive": "Value must be greater than zero.",

        "export.encrypt_ask": "Encrypt Export?",
        "export.encrypt_ask_desc": "A random password will be generated and required for import.",
        "export.password_title": "Encryption Password",
        "export.password_desc": "Save this password securely. It is required to import this file.",
        "import.password_title": "Enter Password",
        "import.password_desc": "Encrypted data detected. Enter password to decrypt.",
        "import.decrypt_error": "Decryption failed. Wrong password or corrupted data.",
        "qr.encrypt_label": "Encrypt",

        "btn.add": "Add Dose",
        "btn.save": "Save",
        "btn.cancel": "Cancel",
        "btn.edit": "Edit",
        "btn.ok": "OK",
        "btn.copy": "Copy",

        "dialog.confirm_title": "Confirm",
        "dialog.alert_title": "Alert",

        "modal.weight.title": "Body Weight",
        "modal.weight.desc": "Affects peak concentration estimates.",
        "modal.dose.add_title": "Add Dose",
        "modal.dose.edit_title": "Edit Dose",

        "field.time": "Time",
        "field.route": "Route",
        "field.ester": "Compound",
        "field.dose_raw": "Dose (mg)",
        "field.dose_e2": "E2 Equivalent (mg)",
        "field.patch_mode": "Input Mode",
        "field.patch_rate": "Rate (µg/day)",
        "field.patch_total": "Total Dose (mg)",
        "field.sl_duration": "Hold Duration (minutes)",
        "field.sl_custom": "Custom θ",
        "field.gel_site": "Application Site",

        "sl.instructions": "Minimize swallowing. Hold dissolved saliva until target time.",
        "sl.mode.quick": "2m",
        "sl.mode.casual": "5m",
        "sl.mode.standard": "10m",
        "sl.mode.strict": "15m",

        "route.injection": "Injection",
        "route.oral": "Oral",
        "route.sublingual": "Sublingual",
        "route.gel": "Gel (Beta)",
        "gel.site.arm": "Arm",
        "gel.site.thigh": "Thigh",
        "gel.site.scrotal": "Scrotal",
        "beta.gel": "Beta: gel bioavailability is approximate; data limited.",
        "gel.site_disabled": "Application site selection is still in development and temporarily disabled.",
        "beta.patch": "Beta: patch parameters are approximate. Log both apply and removal times.",
        "beta.patch_remove": "Just record the removal time; dose is derived from wear duration.",
        "route.patchApply": "Patch Apply (Beta)",
        "route.patchRemove": "Patch Remove (Beta)",

        "ester.E2": "Estradiol (E2)",
        "ester.EV": "Estradiol Valerate (EV)",
        "ester.EB": "Estradiol Benzoate (EB)",
        "ester.EC": "Estradiol Cypionate (EC)",
        "ester.EN": "Estradiol Enanthate (EN)",
        "drawer.lang": "Language",
        "drawer.lang_hint": "Switch interface language.",
        "drawer.model_title": "Model Explanation",
        "drawer.model_desc": "Learn about the underlying PK model.",
        "drawer.model_confirm": "You are about to visit a third-party website (misaka23323.com). Continue?",
        "drawer.github_confirm": "You are about to visit a third-party website (github.com). Continue?",

        "settings.group.general": "General",
        "settings.group.data": "Data Management",
        "settings.group.about": "About",
        "settings.version": "Version",
    },
    ru: {
        "app.title": "HRT Recorder",
        "nav.home": "Обзор",
        "nav.history": "История",
        "nav.settings": "Настройки",
        "status.estimate": "Текущая оценка",
        "status.weight": "Вес",
        "chart.title": "График кон. E2 (пг/мл)",
        "chart.tooltip.conc": "Конц.",
        "chart.tooltip.time": "Время",
        "chart.now": "СЕЙЧАС",
        "chart.reset": "Сброс масштаба",
        "timeline.title": "История приема",
        "timeline.empty": "Записей нет.",
        "timeline.delete_confirm": "Вы уверены, что хотите удалить эту запись?",
        "timeline.dose_label": "Доза",
        "timeline.bio_label": "Доза",
        "drawer.title": "Инструменты",
        "drawer.clear": "Очистить все дозы",
        "drawer.clear_confirm": "Удалить все? Нельзя отменить.",
        "drawer.save": "Сохранить дозы (JSON)",
        "drawer.save_hint": "Скачать резервную копию JSON.",
        "drawer.import": "Импортировать дозы (JSON)",
        "drawer.import_hint": "Импорт JSON с заменой.",
        "drawer.github": "GitHub репозиторий",
        "drawer.github_desc": "Исходный код и отзывы.",
        "drawer.empty_export": "Нет доз для экспорта.",
        
        "settings.group.general": "Общие",
        "settings.group.data": "Управление данными",
        "settings.group.about": "О приложении",
        "settings.version": "Версия",
        "drawer.import_error": "Ошибка импорта. Пожалуйста, проверьте правильность файла.",
        "drawer.import_success": "Дозы успешно импортированы.",
        "drawer.close": "Закрыть панель",
        "drawer.qr": "QR Импорт/Экспорт",
        "drawer.qr_hint": "QR-код для обмена/восстановления.",
        "drawer.lang": "Язык",
        "drawer.lang_hint": "Переключить язык интерфейса.",
        "drawer.model_title": "Описание модели",
        "drawer.model_desc": "Узнайте о модели фармакокинетики.",
        "drawer.model_confirm": "Вы переходите на сторонний сайт (misaka23323.com). Продолжить?",
        "drawer.github_confirm": "Вы переходите на сторонний сайт (github.com). Продолжить?",
        "import.title": "Импорт данных",
        "import.text": "Вставить текст JSON",
        "import.paste_hint": "Вставьте содержимое JSON сюда...",
        "import.file": "Выбрать файл JSON",
        "import.file_btn": "Выберите файл",
        "qr.title": "QR Импорт и Экспорт",
        "qr.export.title": "Экспорт доз в QR",
        "qr.export.empty": "Добавьте хотя бы одну дозу для генерации QR-кода.",
        "qr.copy": "Копировать JSON",
        "qr.copied": "Скопировано",
        "qr.copy_hint": "Вы также можете поделиться необработанным текстом JSON.",
        "qr.import.title": "Импорт из QR",
        "qr.import.file": "Загрузить изображение QR",
        "qr.import.scan": "Начать сканирование камерой",
        "qr.import.stop": "Остановить сканирование",
        "qr.scan.hint": "Выровняйте QR-код внутри рамки.",
        "qr.scan.active": "Камера включена. Наведите на QR-код.",
        "qr.upload.hint": "Поддерживаются скриншоты PNG/JPEG.",
        "qr.error.camera": "Ошибка доступа к камере.",
        "qr.error.decode": "Действительный QR не обнаружен.",
        "qr.error.format": "Неверный формат QR.",
        "qr.help": "Содержит ваши данные. Делитесь осторожно.",
        "error.nonPositive": "Значение должно быть больше нуля.",

        "export.encrypt_ask": "Зашифровать экспорт?",
        "export.encrypt_ask_desc": "Будет сгенерирован случайный пароль, необходимый для импорта.",
        "export.password_title": "Пароль шифрования",
        "export.password_desc": "Сохраните этот пароль. Он потребуется для импорта файла.",
        "import.password_title": "Введите пароль",
        "import.password_desc": "Обнаружены зашифрованные данные. Введите пароль.",
        "import.decrypt_error": "Ошибка расшифровки. Неверный пароль или данные повреждены.",
        "qr.encrypt_label": "Зашифровать",

        "btn.add": "Добавить дозу",
        "btn.save": "Сохранить",
        "btn.cancel": "Отмена",
        "btn.edit": "Редактировать",
        "btn.ok": "ОК",
        "btn.copy": "Копировать",

        "dialog.confirm_title": "Подтверждение",
        "dialog.alert_title": "Внимание",

        "modal.weight.title": "Вес тела",
        "modal.weight.desc": "Влияет на оценку пиковой концентрации.",
        "modal.dose.add_title": "Добавить дозу",
        "modal.dose.edit_title": "Редактировать дозу",

        "field.time": "Время",
        "field.route": "Способ",
        "field.ester": "Соединение",
        "field.dose_raw": "Доза (мг)",
        "field.dose_e2": "Эквивалент E2 (мг)",
        "field.patch_mode": "Режим ввода",
        "field.patch_rate": "Скорость (мкг/день)",
        "field.patch_total": "Общая доза (мг)",
        "field.sl_duration": "Длительность удержания (min)",
        "field.sl_custom": "Пользовательский θ",
        "field.gel_site": "Место нанесения",

        "sl.instructions": "Меньше глотайте. Держите слюну до целевого времени.",
        "sl.mode.quick": "2м",
        "sl.mode.casual": "5м",
        "sl.mode.standard": "10м",
        "sl.mode.strict": "15м",

        "route.injection": "Инъекция",
        "route.oral": "Перорально",
        "route.sublingual": "Сублингвально",
        "route.gel": "Гель (Beta)",
        "gel.site.arm": "Рука (Arm)",
        "gel.site.thigh": "Бедро (Thigh)",
        "gel.site.scrotal": "Мошонка (Scrotal)",
        "beta.gel": "Beta: биодоступность геля приблизительная, данных мало.",
        "gel.site_disabled": "Выбор места нанесения в разработке и временно недоступен.",
        "beta.patch": "Beta: параметры пластыря приблизительны. Отмечайте время наклеивания и снятия.",
        "beta.patch_remove": "Достаточно указать время снятия — доза вычислится по времени ношения.",
        "route.patchApply": "Пластырь (Наложение) Beta",
        "route.patchRemove": "Пластырь (Снятие) Beta",

        "ester.E2": "Эстрадиол (E2)",
        "ester.EV": "Эстрадиол валерат (EV)",
        "ester.EB": "Эстрадиол бензоат (EB)",
        "ester.EC": "Эстрадиол ципионат (EC)",
        "ester.EN": "Эстрадиол энантат (EN)",
    }
};

const TRANSLATIONS = {
    zh: TRANSLATIONS_BASE.zh,
    "zh-TW": {
        "app.title": "HRT 記錄",
        "nav.home": "總覽",
        "nav.history": "記錄",
        "nav.settings": "設定",
        "status.estimate": "當前估算濃度",
        "status.weight": "體重",
        "chart.title": "雌二醇濃度 (pg/mL)",
        "chart.tooltip.conc": "濃度",
        "chart.tooltip.time": "時間",
        "chart.now": "現在",
        "chart.reset": "重置縮放",
        "timeline.title": "用藥記錄",
        "timeline.empty": "暫無記錄",
        "timeline.delete_confirm": "確定刪除這條記錄嗎？",
        "timeline.dose_label": "劑量",
        "timeline.bio_label": "劑量",
        "drawer.title": "實用工具",
        "drawer.clear": "清空所有劑量",
        "drawer.clear_confirm": "刪除所有記錄？不可撤銷。",
        "drawer.save": "保存劑量 JSON",
        "drawer.save_hint": "下載 JSON 備份。",
        "drawer.import": "導入劑量 JSON",
        "drawer.import_hint": "導入 JSON 並覆蓋。",
        "drawer.github": "GitHub 倉庫",
        "drawer.github_desc": "查看源代碼與回饋。",
        "drawer.empty_export": "當前沒有可保存的劑量記錄。",
        "drawer.import_error": "導入失敗，請確認文件內容有效。",
        "drawer.import_success": "導入成功，已更新劑量記錄。",
        "drawer.close": "關閉側欄",
        "drawer.qr": "二維碼導入導出",
        "drawer.qr_hint": "二維碼分享或恢復。",
        "import.title": "導入資料",
        "import.text": "貼上 JSON 文字",
        "import.paste_hint": "在此處貼上 JSON 內容...",
        "import.file": "選擇 JSON 文件",
        "import.file_btn": "選擇文件",
        "qr.title": "二維碼導入導出",
        "qr.export.title": "導出劑量到二維碼",
        "qr.export.empty": "當前沒有可導出的劑量記錄。",
        "qr.copy": "複製 JSON",
        "qr.copied": "已複製",
        "qr.copy_hint": "也可以直接複製 JSON 文字進行分享。",
        "qr.import.title": "二維碼導入",
        "qr.import.file": "上傳二維碼圖片",
        "qr.import.scan": "開啟攝像頭掃描",
        "qr.import.stop": "停止掃描",
        "qr.scan.hint": "請將二維碼置於取景框中央。",
        "qr.scan.active": "攝像頭已開啟，請對準二維碼。",
        "qr.upload.hint": "支持 PNG/JPEG 等常見格式。",
        "qr.error.camera": "無法訪問攝像頭。",
        "qr.error.decode": "未檢測到有效二維碼。",
        "qr.error.format": "二維碼內容無效。",
        "qr.help": "含個人資料，謹慎分享。",
        "error.nonPositive": "不能輸入小於等於 0 的值",
        "export.encrypt_ask": "是否加密導出？",
        "export.encrypt_ask_desc": "加密後將生成隨機密碼，導入時必須輸入該密碼。",
        "export.password_title": "文件加密密碼",
        "export.password_desc": "請妥善保存此密碼，導入該文件時需要使用。",
        "import.password_title": "輸入密碼",
        "import.password_desc": "檢測到加密資料，請輸入密碼解密。",
        "import.decrypt_error": "解密失敗，密碼錯誤或資料損壞。",
        "qr.encrypt_label": "加密",
        "btn.add": "新增給藥",
        "btn.save": "保存",
        "btn.cancel": "取消",
        "btn.edit": "編輯",
        "btn.ok": "確定",
        "btn.copy": "複製",
        "dialog.confirm_title": "確認",
        "dialog.alert_title": "提示",
        "modal.weight.title": "設定體重",
        "modal.weight.desc": "用於估算濃度峰值。",
        "modal.dose.add_title": "新增用藥",
        "modal.dose.edit_title": "編輯用藥",
        "field.time": "給藥時間",
        "field.route": "給藥途徑",
        "field.ester": "藥物種類",
        "field.dose_raw": "藥物劑量 (mg)",
        "field.dose_e2": "等效 E2 (mg)",
        "field.patch_mode": "輸入模式",
        "field.patch_rate": "釋放速率 (µg/天)",
        "field.patch_total": "總劑量 (mg)",
        "field.sl_duration": "含服時長 (分鐘)",
        "field.sl_custom": "自定義 θ",
        "field.gel_site": "塗抹位置",
        "sl.instructions": "少吞嚥，含住藥液直至目標時間。",
        "sl.mode.quick": "快速 (2 分)",
        "sl.mode.casual": "隨意 (5 分)",
        "sl.mode.standard": "標準 (10 分)",
        "sl.mode.strict": "嚴格 (15 分)",
        "route.injection": "肌注 (Injection)",
        "route.oral": "口服 (Oral)",
        "route.sublingual": "舌下 (Sublingual)",
        "route.gel": "凝膠 (Beta)",
        "gel.site.arm": "手臂 (Arm)",
        "gel.site.thigh": "大腿 (Thigh)",
        "gel.site.scrotal": "陰囊 (Scrotal)",
        "beta.gel": "Beta：凝膠生物利用率資料有限，數值為近似估計。",
        "gel.site_disabled": "塗抹部位選擇仍在開發中，當前暫不可用。",
        "beta.patch": "Beta：貼片參數為近似值，請記錄貼上與移除時間。",
        "beta.patch_remove": "記錄移除時間即可，劑量會自動按貼片佩戴時長計算。",
        "route.patchApply": "貼片貼上 (Beta)",
        "route.patchRemove": "貼片移除 (Beta)",
        "ester.E2": "雌二醇 (E2)",
        "ester.EV": "戊酸雌二醇 (EV)",
        "ester.EB": "苯甲酸雌二醇 (EB)",
        "ester.EC": "環戊丙酸雌二醇 (EC)",
        "ester.EN": "庚酸雌二醇 (EN)",
        "settings.group.general": "常規設定",
        "settings.group.data": "資料管理",
        "settings.group.about": "關於",
        "settings.version": "版本號",
        "drawer.lang": "語言設定",
        "drawer.lang_hint": "切換介面顯示語言。",
        "drawer.model_title": "底層模型詳解",
        "drawer.model_desc": "了解估算背後的藥代動力學模型。",
        "drawer.model_confirm": "即將訪問第三方網站 (misaka23323.com)，是否繼續？",
        "drawer.github_confirm": "即將訪問第三方網站 (github.com)，是否繼續？",
    },
    yue: {
        ...TRANSLATIONS_BASE.zh,
        "app.title": "HRT 記錄",
        "nav.home": "總覽",
        "nav.history": "記錄",
        "nav.settings": "設定",
        "status.estimate": "當前估算濃度",
        "status.weight": "體重",
        "chart.title": "雌二醇濃度 (pg/mL)",
        "chart.tooltip.conc": "濃度",
        "chart.tooltip.time": "時間",
        "chart.now": "而家",
        "chart.reset": "重置縮放",
        "timeline.title": "用藥記錄",
        "timeline.empty": "暫時未有記錄",
        "timeline.delete_confirm": "確認刪除呢條記錄？",
        "timeline.dose_label": "劑量",
        "timeline.bio_label": "劑量",
        "drawer.title": "實用工具",
        "drawer.clear": "清空所有劑量",
        "drawer.clear_confirm": "刪晒所有記錄？呢步唔可撤銷。",
        "drawer.save": "保存劑量 JSON",
        "drawer.save_hint": "下載 JSON 備份。",
        "drawer.import": "導入劑量 JSON",
        "drawer.import_hint": "導入 JSON 並覆蓋。",
        "drawer.github": "GitHub 倉庫",
        "drawer.github_desc": "睇源碼同反饋。",
        "drawer.empty_export": "而家未有可保存嘅劑量記錄。",
        "drawer.import_error": "導入失敗，請檢查文件內容。",
        "drawer.import_success": "導入成功，已更新劑量記錄。",
        "drawer.close": "收埋側欄",
        "drawer.qr": "二維碼導入導出",
        "drawer.qr_hint": "用二維碼分享或者恢復。",
        "import.title": "導入數據",
        "import.text": "貼上 JSON 文字",
        "import.paste_hint": "喺度貼上 JSON 內容...",
        "import.file": "揀 JSON 文件",
        "import.file_btn": "揀文件",
        "qr.title": "二維碼導入導出",
        "qr.export.title": "導出劑量到二維碼",
        "qr.export.empty": "未有可導出嘅劑量。",
        "qr.copy": "複製 JSON",
        "qr.copied": "已複製",
        "qr.copy_hint": "可以直接複製 JSON 文字去分享。",
        "qr.import.title": "二維碼導入",
        "qr.import.file": "上載二維碼圖片",
        "qr.import.scan": "開鏡頭掃描",
        "qr.import.stop": "停掃描",
        "qr.scan.hint": "請將二維碼放中間。",
        "qr.scan.active": "鏡頭開咗，對準二維碼。",
        "qr.upload.hint": "支援 PNG/JPEG。",
        "qr.error.camera": "鏡頭訪問失敗。",
        "qr.error.decode": "未識別到有效二維碼。",
        "qr.error.format": "二維碼內容無效。",
        "qr.help": "含個人數據，分享要小心。",
        "error.nonPositive": "唔可以輸入小於等於 0 嘅值",
        "export.encrypt_ask": "要唔要加密導出？",
        "export.encrypt_ask_desc": "加密會生成隨機密碼，導入要用。",
        "export.password_title": "文件加密密碼",
        "export.password_desc": "請好好保存，導入要用。",
        "import.password_title": "輸入密碼",
        "import.password_desc": "偵測到加密數據，請輸入密碼。",
        "import.decrypt_error": "解密失敗，密碼錯或者數據壞咗。",
        "qr.encrypt_label": "加密",
        "btn.add": "新增記錄",
        "btn.save": "保存",
        "btn.cancel": "取消",
        "btn.edit": "編輯",
        "btn.ok": "確定",
        "btn.copy": "複製",
        "dialog.confirm_title": "確認",
        "dialog.alert_title": "提示",
        "modal.weight.title": "設定體重",
        "modal.weight.desc": "用來估算峰值濃度。",
        "modal.dose.add_title": "新增用藥",
        "modal.dose.edit_title": "編輯用藥",
        "field.time": "給藥時間",
        "field.route": "給藥途徑",
        "field.ester": "藥物種類",
        "field.dose_raw": "藥物劑量 (mg)",
        "field.dose_e2": "等效 E2 (mg)",
        "field.patch_mode": "輸入模式",
        "field.patch_rate": "釋放速率 (µg/天)",
        "field.patch_total": "總劑量 (mg)",
        "field.sl_duration": "含服時間 (分鐘)",
        "field.sl_custom": "自定義 θ",
        "field.gel_site": "塗抹位置",
        "sl.instructions": "盡量唔好吞，含到時間到。",
        "sl.mode.quick": "快 (2 分)",
        "sl.mode.casual": "隨意 (5 分)",
        "sl.mode.standard": "標準 (10 分)",
        "sl.mode.strict": "嚴格 (15 分)",
        "route.injection": "肌注 (Injection)",
        "route.oral": "口服 (Oral)",
        "route.sublingual": "舌下 (Sublingual)",
        "route.gel": "凝膠 (Beta)",
        "gel.site.arm": "手臂 (Arm)",
        "gel.site.thigh": "大腿 (Thigh)",
        "gel.site.scrotal": "陰囊 (Scrotal)",
        "beta.gel": "Beta：凝膠生物利用率數據有限，數值為近似估計。",
        "gel.site_disabled": "塗抹部位選擇仲喺開發，暫時用唔到。",
        "beta.patch": "Beta：貼片參數係近似值，記低貼上同移除時間。",
        "beta.patch_remove": "記低移除時間就得，劑量會按佩戴時間計。",
        "route.patchApply": "貼片貼上 (Beta)",
        "route.patchRemove": "貼片移除 (Beta)",
        "ester.E2": "雌二醇 (E2)",
        "ester.EV": "戊酸雌二醇 (EV)",
        "ester.EB": "苯甲酸雌二醇 (EB)",
        "ester.EC": "環戊丙酸雌二醇 (EC)",
        "ester.EN": "庚酸雌二醇 (EN)",
        "settings.group.general": "常規設定",
        "settings.group.data": "數據管理",
        "settings.group.about": "關於",
        "settings.version": "版本號",
        "drawer.lang": "語言設定",
        "drawer.lang_hint": "切換介面顯示語言。",
        "drawer.model_title": "底層模型詳解",
        "drawer.model_desc": "了解估算背後嘅藥代動力學模型。",
        "drawer.model_confirm": "要打開第三方網站 (misaka23323.com) 嗎？",
        "drawer.github_confirm": "要打開第三方網站 (github.com) 嗎？",
    },
    en: TRANSLATIONS_BASE.en,
    ru: TRANSLATIONS_BASE.ru,
    uk: {
        "app.title": "HRT Записник",
        "nav.home": "Огляд",
        "nav.history": "Журнал",
        "nav.settings": "Налаштування",
        "status.estimate": "Поточна оцінка",
        "status.weight": "Вага",
        "chart.title": "Графік E2 (pg/mL)",
        "chart.tooltip.conc": "Конц.",
        "chart.tooltip.time": "Час",
        "chart.now": "ЗАРАЗ",
        "chart.reset": "Скинути масштаб",
        "timeline.title": "Історія доз",
        "timeline.empty": "Записів поки немає",
        "timeline.delete_confirm": "Видалити цей запис?",
        "timeline.dose_label": "Доза",
        "timeline.bio_label": "Доза",
        "drawer.title": "Інструменти",
        "drawer.clear": "Очистити всі дози",
        "drawer.clear_confirm": "Очистити все? Це незворотно.",
        "drawer.save": "Зберегти дози (JSON)",
        "drawer.save_hint": "Завантажити резервну копію JSON.",
        "drawer.import": "Імпорт доз (JSON)",
        "drawer.import_hint": "Імпортувати JSON і перезаписати.",
        "drawer.lang": "Мова інтерфейсу",
        "drawer.lang_hint": "Перемкнути мову відображення.",
        "drawer.github": "GitHub репозиторій",
        "drawer.github_desc": "Код та відгуки.",
        "drawer.empty_export": "Немає даних для експорту.",
        "drawer.import_error": "Імпорт не вдався. Перевірте файл.",
        "drawer.import_success": "Успішно імпортовано.",
        "drawer.close": "Закрити",
        "drawer.qr": "QR імпорт/експорт",
        "drawer.qr_hint": "Поділитися або відновити через QR.",
        "import.title": "Імпорт даних",
        "import.text": "Вставте JSON",
        "import.paste_hint": "Вставте JSON сюди...",
        "import.file": "Обрати JSON файл",
        "import.file_btn": "Обрати файл",
        "qr.title": "QR імпорт/експорт",
        "qr.export.title": "Експорт доз у QR",
        "qr.export.empty": "Додайте хоча б одну дозу.",
        "qr.copy": "Копіювати JSON",
        "qr.copied": "Скопійовано",
        "qr.copy_hint": "Можна ділитися сирим JSON.",
        "qr.import.title": "Імпорт з QR",
        "qr.import.file": "Завантажити QR зображення",
        "qr.import.scan": "Запустити камеру",
        "qr.import.stop": "Зупинити скан",
        "qr.scan.hint": "Наведіть QR у рамку.",
        "qr.scan.active": "Камера ввімкнена, наведіть QR.",
        "qr.upload.hint": "Підтримка PNG/JPEG.",
        "qr.error.camera": "Нема доступу до камери.",
        "qr.error.decode": "QR не розпізнано.",
        "qr.error.format": "Невірний вміст QR.",
        "qr.help": "Містить ваші дані, діліться обережно.",
        "error.nonPositive": "Значення має бути > 0.",
        "export.encrypt_ask": "Шифрувати експорт?",
        "export.encrypt_ask_desc": "Буде згенеровано пароль, потрібен для імпорту.",
        "export.password_title": "Пароль шифрування",
        "export.password_desc": "Збережіть пароль. Без нього імпорт неможливий.",
        "import.password_title": "Введіть пароль",
        "import.password_desc": "Дані зашифровані. Введіть пароль.",
        "import.decrypt_error": "Помилка розшифрування. Пароль? Дані?",
        "qr.encrypt_label": "Шифрувати",
        "btn.add": "Додати дозу",
        "btn.save": "Зберегти",
        "btn.cancel": "Скасувати",
        "btn.edit": "Редагувати",
        "btn.ok": "OK",
        "btn.copy": "Копіювати",
        "dialog.confirm_title": "Підтвердження",
        "dialog.alert_title": "Увага",
        "modal.weight.title": "Маса тіла",
        "modal.weight.desc": "Впливає на оцінку піку.",
        "modal.dose.add_title": "Нова доза",
        "modal.dose.edit_title": "Редагувати дозу",
        "field.time": "Час",
        "field.route": "Шлях",
        "field.ester": "Сполука",
        "field.dose_raw": "Доза препарату (мг)",
        "field.dose_e2": "Еквівалент E2 (мг)",
        "field.patch_mode": "Режим введення",
        "field.patch_rate": "Швидкість (мкг/день)",
        "field.patch_total": "Загальна доза (мг)",
        "field.sl_duration": "Тривалість утримання (хв)",
        "field.sl_custom": "Корист. θ",
        "field.gel_site": "Місце нанесення",
        "sl.instructions": "Менше ковтати, тримайте до часу.",
        "sl.mode.quick": "2хв",
        "sl.mode.casual": "5хв",
        "sl.mode.standard": "10хв",
        "sl.mode.strict": "15хв",
        "route.injection": "Ін'єкція",
        "route.oral": "Перорально",
        "route.sublingual": "Під'язиково",
        "route.gel": "Гель (Beta)",
        "gel.site.arm": "Рука",
        "gel.site.thigh": "Стегно",
        "gel.site.scrotal": "Мошонка",
        "beta.gel": "Beta: біодоступність гелю приблизна, даних мало.",
        "gel.site_disabled": "Вибір місця поки недоступний.",
        "beta.patch": "Beta: параметри пластиру приблизні. Фіксуйте час.",
        "beta.patch_remove": "Достатньо вказати час зняття — доза розрахується.",
        "route.patchApply": "Пластир (наклеїти) Beta",
        "route.patchRemove": "Пластир (зняти) Beta",
        "ester.E2": "Естрадіол (E2)",
        "ester.EV": "Естрадіол валерат (EV)",
        "ester.EB": "Естрадіол бензоат (EB)",
        "ester.EC": "Естрадіол ципіонат (EC)",
        "ester.EN": "Естрадіол енантат (EN)",
        "settings.group.general": "Загальні",
        "settings.group.data": "Дані",
        "settings.group.about": "Про застосунок",
        "settings.version": "Версія",
        "drawer.model_title": "Модель розрахунку",
        "drawer.model_desc": "Деталі фармакокінетичної моделі.",
        "drawer.model_confirm": "Відкрити сторонній сайт (misaka23323.com)?",
        "drawer.github_confirm": "Відкрити GitHub (github.com)?",
    },
} as const;

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string } | null>(null);

const useTranslation = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
    return ctx;
};

const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('hrt-lang') as Lang) || 'zh');

    useEffect(() => {
        localStorage.setItem('hrt-lang', lang);
        document.title = (lang.startsWith('zh') || lang === 'yue') ? "HRT 记录" : "HRT Recorder";
    }, [lang]);

    const t = (key: string) => {
        const pack = (TRANSLATIONS as any)[lang] || TRANSLATIONS.zh;
        return pack[key] ?? TRANSLATIONS.zh[key as keyof typeof TRANSLATIONS.zh] ?? TRANSLATIONS.en[key as keyof typeof TRANSLATIONS.en] ?? key;
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

// --- Dialog Context ---

type DialogType = 'alert' | 'confirm';

interface DialogContextType {
    showDialog: (type: DialogType, message: string, onConfirm?: () => void) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

const useDialog = () => {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error("useDialog must be used within DialogProvider");
    return ctx;
};

const DialogProvider = ({ children }: { children: React.ReactNode }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<DialogType>('alert');
    const [message, setMessage] = useState("");
    const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

    const showDialog = useCallback((type: DialogType, message: string, onConfirm?: () => void) => {
        setType(type);
        setMessage(message);
        setOnConfirm(() => onConfirm || null);
        setIsOpen(true);
    }, []);

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        setIsOpen(false);
    };

    return (
        <DialogContext.Provider value={{ showDialog }}>
            {children}
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" style={{ animation: 'dialogFadeIn 0.2s ease-out forwards' }}>
                    <style>{`
                        @keyframes dialogFadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes dialogZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                    `}</style>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100" style={{ animation: 'dialogZoomIn 0.2s ease-out forwards' }}>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            {type === 'confirm' ? t('dialog.confirm_title') : t('dialog.alert_title')}
                        </h3>
                        <p className="text-gray-600 mb-6 leading-relaxed text-sm">{message}</p>
                        <div className="flex gap-3">
                            {type === 'confirm' && (
                                <button 
                                    onClick={() => setIsOpen(false)} 
                                    className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                                >
                                    {t('btn.cancel')}
                                </button>
                            )}
                            <button 
                                onClick={handleConfirm} 
                                className="flex-1 py-3 bg-pink-400 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-100 transition"
                            >
                                {t('btn.ok')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};

// --- Helper Functions ---

const formatDate = (date: Date, lang: Lang) => {
    const locale = lang === 'zh' ? 'zh-CN' : (lang === 'ru' ? 'ru-RU' : 'en-US');
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getRouteIcon = (route: Route) => {
    switch (route) {
        case Route.injection: return <Syringe className="w-5 h-5 text-pink-400" />;
        case Route.oral: return <Pill className="w-5 h-5 text-blue-500" />;
        case Route.sublingual: return <Pill className="w-5 h-5 text-teal-500" />;
        case Route.gel: return <Droplet className="w-5 h-5 text-cyan-500" />;
        case Route.patchApply: return <Sticker className="w-5 h-5 text-orange-500" />;
        case Route.patchRemove: return <X className="w-5 h-5 text-gray-400" />;
    }
};

const getBioDoseMG = (event: DoseEvent) => {
    const multiplier = getBioavailabilityMultiplier(event.route, event.ester, event.extras || {});
    return multiplier * event.doseMG;
};

const getRawDoseMG = (event: DoseEvent) => {
    if (event.route === Route.patchRemove) return null;
    if (event.extras[ExtraKey.releaseRateUGPerDay]) return null;
    const factor = getToE2Factor(event.ester);
    if (!factor) return event.doseMG;
    return event.doseMG / factor;
};

// --- Components ---

const CustomSelect = ({ value, onChange, options, label }: { value: string, onChange: (val: string) => void, options: { value: string, label: string, icon?: React.ReactNode }[], label?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="space-y-2" ref={containerRef}>
            {label && <label className="block text-sm font-bold text-gray-700">{label}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none flex items-center justify-between transition-all"
                >
                    <div className="flex items-center gap-2">
                        {selectedOption?.icon}
                        <span className="font-medium text-gray-800">{selectedOption?.label || value}</span>
                    </div>
                    <ChevronDown size={20} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full p-3 text-left flex items-center gap-2 hover:bg-pink-50 transition-colors
                                    ${opt.value === value ? 'bg-pink-50 text-pink-600 font-bold' : 'text-gray-700'}`}
                            >
                                {opt.icon}
                                <span>{opt.label}</span>
                                {opt.value === value && <div className="ml-auto w-2 h-2 rounded-full bg-pink-400" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const PasswordDisplayModal = ({ isOpen, onClose, password }: { isOpen: boolean, onClose: () => void, password: string }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">{t('export.password_title')}</h3>
                <p className="text-sm text-gray-500 mb-6 text-center">{t('export.password_desc')}</p>
                
                <div className="bg-gray-100 p-4 rounded-xl mb-6 flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-gray-800 tracking-wider">{password}</span>
                    <button onClick={handleCopy} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600">
                        {copied ? <span className="text-xs font-bold text-green-600">{t('qr.copied')}</span> : <Copy size={20} />}
                    </button>
                </div>

                <button onClick={onClose} className="w-full py-3.5 bg-pink-400 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-100 transition">
                    {t('btn.ok')}
                </button>
            </div>
        </div>
    );
};

const PasswordInputModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: (pw: string) => void }) => {
    const { t } = useTranslation();
    const [password, setPassword] = useState("");

    useEffect(() => {
        if (isOpen) setPassword("");
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">{t('import.password_title')}</h3>
                <p className="text-sm text-gray-500 mb-6 text-center">{t('import.password_desc')}</p>
                
                <input
                    type="text"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none font-mono text-center text-lg mb-6"
                    placeholder="..."
                    autoFocus
                />

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition">{t('btn.cancel')}</button>
                    <button 
                        onClick={() => onConfirm(password)} 
                        disabled={!password}
                        className="flex-1 py-3.5 bg-pink-400 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-100 transition disabled:opacity-50"
                    >
                        {t('btn.ok')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ExportModal = ({ isOpen, onClose, onExport }: { isOpen: boolean, onClose: () => void, onExport: (encrypt: boolean) => void }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">{t('drawer.save')}</h3>
                <div className="space-y-3">
                    <button onClick={() => onExport(false)} className="w-full py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2">
                        <Download size={20} />
                        JSON
                    </button>
                    <button onClick={() => onExport(true)} className="w-full py-4 bg-pink-400 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-100 transition flex items-center justify-center gap-2">
                        <Lock size={20} />
                        JSON (Encrypted)
                    </button>
                </div>
                <button onClick={onClose} className="mt-6 w-full py-2 text-gray-400 font-bold hover:text-gray-600 transition">
                    {t('btn.cancel')}
                </button>
            </div>
        </div>
    );
};

const WeightEditorModal = ({ isOpen, onClose, currentWeight, onSave }: any) => {
    const { t } = useTranslation();
    const { showDialog } = useDialog();
    const [weightStr, setWeightStr] = useState(currentWeight.toString());

    useEffect(() => setWeightStr(currentWeight.toString()), [currentWeight, isOpen]);

    const handleSave = () => {
        const val = parseFloat(weightStr);
        if (!isNaN(val) && val > 0) {
            onSave(val);
            onClose();
        } else {
            showDialog('alert', t('error.nonPositive'));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{t('modal.weight.title')}</h3>
                
                <div className="flex justify-center mb-8">
                    <div className="relative flex flex-col items-center">
                        <input 
                            type="number" 
                            inputMode="decimal"
                            value={weightStr}
                            onChange={(e) => setWeightStr(e.target.value)}
                            className="text-5xl font-black text-pink-400 tabular-nums w-48 text-center bg-transparent border-b-2 border-pink-100 focus:border-pink-400 outline-none transition-colors pb-2"
                            placeholder="0.0"
                            autoFocus
                        />
                        <div className="text-sm font-medium text-gray-400 mt-2">kg</div>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl mb-6 flex gap-3 items-start">
                    <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                        {t('modal.weight.desc')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition">{t('btn.cancel')}</button>
                    <button onClick={handleSave} className="flex-1 py-3.5 bg-pink-400 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-100 transition">{t('btn.save')}</button>
                </div>
            </div>
        </div>
    );
};

const DoseFormModal = ({ isOpen, onClose, eventToEdit, onSave }: any) => {
    const { t } = useTranslation();
    const { showDialog } = useDialog();
    const dateInputRef = useRef<HTMLInputElement>(null);
    
    // Form State
    const [dateStr, setDateStr] = useState("");
    const [route, setRoute] = useState<Route>(Route.injection);
    const [ester, setEster] = useState<Ester>(Ester.EV);
    
    const [rawDose, setRawDose] = useState("");
    const [e2Dose, setE2Dose] = useState("");
    
    const [patchMode, setPatchMode] = useState<"dose" | "rate">("dose");
    const [patchRate, setPatchRate] = useState("");

    const [gelSite, setGelSite] = useState(0); // Index in GEL_SITE_ORDER

    const [slTier, setSlTier] = useState(2);
    const [useCustomTheta, setUseCustomTheta] = useState(false);
    const [customTheta, setCustomTheta] = useState("");
    const [lastEditedField, setLastEditedField] = useState<'raw' | 'bio'>('bio');

    const slExtras = useMemo(() => {
        if (route !== Route.sublingual) return null;
        if (useCustomTheta) {
            const parsed = parseFloat(customTheta);
            const theta = Number.isFinite(parsed) ? parsed : 0.11;
            const clamped = Math.max(0, Math.min(1, theta));
            return { [ExtraKey.sublingualTheta]: clamped };
        }
        return { [ExtraKey.sublingualTier]: slTier };
    }, [route, useCustomTheta, customTheta, slTier]);

    const bioMultiplier = useMemo(() => {
        const extrasForCalc = slExtras ?? {};
        if (route === Route.gel) {
            extrasForCalc[ExtraKey.gelSite] = gelSite;
        }
        return getBioavailabilityMultiplier(route, ester, extrasForCalc);
    }, [route, ester, slExtras, gelSite]);

    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                const d = new Date(eventToEdit.timeH * 3600000);
                const iso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                setDateStr(iso);
                setRoute(eventToEdit.route);
                setEster(eventToEdit.ester);
                
                if (eventToEdit.route === Route.patchApply && eventToEdit.extras[ExtraKey.releaseRateUGPerDay]) {
                    setPatchMode("rate");
                    setPatchRate(eventToEdit.extras[ExtraKey.releaseRateUGPerDay].toString());
                    setE2Dose("");
                    setRawDose("");
                    setLastEditedField('bio');
                } else {
                    setPatchMode("dose");
                    // Fix: Show E2 Equivalent (MW only), not Bioavailable dose
                    const factor = getToE2Factor(eventToEdit.ester);
                    const e2Val = eventToEdit.doseMG * factor;
                    setE2Dose(e2Val.toFixed(3));

                    if (eventToEdit.ester !== Ester.E2) {
                        setRawDose(eventToEdit.doseMG.toFixed(3));
                        setLastEditedField('raw');
                    } else {
                        setRawDose(eventToEdit.doseMG.toFixed(3));
                        setLastEditedField('bio');
                    }
                }

                if (eventToEdit.route === Route.sublingual) {
                    if (eventToEdit.extras[ExtraKey.sublingualTier] !== undefined) {
                         setSlTier(eventToEdit.extras[ExtraKey.sublingualTier]);
                         setUseCustomTheta(false);
                         setCustomTheta("");
                    } else if (eventToEdit.extras[ExtraKey.sublingualTheta] !== undefined) {
                        setUseCustomTheta(true);
                        setCustomTheta(eventToEdit.extras[ExtraKey.sublingualTheta].toString());
                    } else {
                        setUseCustomTheta(false);
                        setCustomTheta("");
                    }
                } else {
                    setUseCustomTheta(false);
                    setCustomTheta("");
                }

                if (eventToEdit.route === Route.gel) {
                    setGelSite(eventToEdit.extras[ExtraKey.gelSite] ?? 0);
                } else {
                    setGelSite(0);
                }

            } else {
                const now = new Date();
                const iso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                setDateStr(iso);
                setRoute(Route.injection);
                setEster(Ester.EV);
                setRawDose("");
                setE2Dose("");
                setPatchMode("dose");
                setPatchRate("");
                setSlTier(2);
                setGelSite(0);
                setUseCustomTheta(false);
                setCustomTheta("");
                setLastEditedField('bio');
            }
        }
    }, [isOpen, eventToEdit]);

    const handleRawChange = (val: string) => {
        setRawDose(val);
        setLastEditedField('raw');
        const v = parseFloat(val);
        if (!isNaN(v)) {
            const factor = getToE2Factor(ester) || 1;
            const e2Equivalent = v * factor; // convert compound mg -> E2 equivalent (pre-bio)
            setE2Dose(e2Equivalent.toFixed(3));
        } else {
            setE2Dose("");
        }
    };

    const handleE2Change = (val: string) => {
        setE2Dose(val);
        setLastEditedField('bio');
        const v = parseFloat(val);
        if (!isNaN(v)) {
            const factor = getToE2Factor(ester) || 1;
            if (ester === Ester.E2) {
                setRawDose(v.toFixed(3));
            } else {
                setRawDose((v / factor).toFixed(3));
            }
        } else {
            setRawDose("");
        }
    };

    useEffect(() => {
        if (lastEditedField === 'raw' && rawDose) {
            handleRawChange(rawDose);
        }
    }, [bioMultiplier, ester, route]);

    useEffect(() => {
        if (lastEditedField === 'bio' && e2Dose) {
            handleE2Change(e2Dose);
        }
    }, [bioMultiplier, ester, route]);

    const handleSave = () => {
        let timeH = new Date(dateStr).getTime() / 3600000;
        if (isNaN(timeH)) {
            timeH = new Date().getTime() / 3600000;
        }
        
        let e2Equivalent = parseFloat(e2Dose);
        if (isNaN(e2Equivalent)) e2Equivalent = 0;
        // For EV injection/sublingual/oral, derive E2-equivalent from raw dose (hidden field) to avoid drift
        if (ester === Ester.EV && (route === Route.injection || route === Route.sublingual || route === Route.oral)) {
            const rawVal = parseFloat(rawDose);
            if (Number.isFinite(rawVal)) {
                const factor = getToE2Factor(ester) || 1;
                e2Equivalent = rawVal * factor;
            }
        }
        let finalDose = 0;

        const extras: any = {};
        const nonPositiveMsg = t('error.nonPositive');

        if (route === Route.patchApply && patchMode === "rate") {
            const rateVal = parseFloat(patchRate);
            if (!Number.isFinite(rateVal) || rateVal <= 0) {
                showDialog('alert', nonPositiveMsg);
                return;
            }
            finalDose = 0;
            extras[ExtraKey.releaseRateUGPerDay] = rateVal;
        } else if (route === Route.patchApply && patchMode === "dose") {
            const raw = parseFloat(rawDose);
            if (!Number.isFinite(raw) || raw <= 0) {
                showDialog('alert', nonPositiveMsg);
                return;
            }
            finalDose = raw; // patch input is compound dose on patch
        } else if (route !== Route.patchRemove) {
            if (!Number.isFinite(e2Equivalent) || e2Equivalent <= 0) {
                showDialog('alert', nonPositiveMsg);
                return;
            }
            const factor = getToE2Factor(ester) || 1;
            finalDose = (ester === Ester.E2) ? e2Equivalent : e2Equivalent / factor; // store compound mg
        }

        if (route === Route.sublingual && slExtras) {
            Object.assign(extras, slExtras);
        }

        if (route === Route.gel) {
            extras[ExtraKey.gelSite] = gelSite;
        }

        const newEvent: DoseEvent = {
            id: eventToEdit?.id || uuidv4(),
            route,
            ester: (route === Route.patchRemove || route === Route.patchApply || route === Route.gel) ? Ester.E2 : ester,
            timeH,
            doseMG: finalDose,
            extras
        };

        onSave(newEvent);
        onClose();
    };

    // Calculate availableEsters unconditionally
    const availableEsters = useMemo(() => {
        switch (route) {
            case Route.injection: return [Ester.EB, Ester.EV, Ester.EC, Ester.EN];
            case Route.oral: 
            case Route.sublingual: return [Ester.E2, Ester.EV];
            default: return [Ester.E2];
        }
    }, [route]);

    // Ensure ester is valid when route changes (e.g. switching from Injection to Gel should force E2)
    useEffect(() => {
        if (!availableEsters.includes(ester)) {
            setEster(availableEsters[0]);
        }
    }, [availableEsters, ester]);

    if (!isOpen) return null;

    const tierKey = SL_TIER_ORDER[slTier] || "standard";
    const currentTheta = SublingualTierParams[tierKey]?.theta || 0.11;

    const activeTheta = useCustomTheta
        ? (slExtras && slExtras[ExtraKey.sublingualTheta] !== undefined
            ? slExtras[ExtraKey.sublingualTheta]!
            : 0.11)
        : currentTheta;
    const bioDoseVal = parseFloat(e2Dose) || 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md h-[85vh] max-h-[90vh] transform transition-all scale-100 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-900">
                        {eventToEdit ? t('modal.dose.edit_title') : t('modal.dose.add_title')}
                    </h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {/* Time */}
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('field.time')}</label>
                        <div className="flex items-center gap-3">
                            <input 
                                ref={dateInputRef}
                                type="datetime-local" 
                                value={dateStr} 
                                onChange={e => setDateStr(e.target.value)} 
                                className="text-xl font-bold text-gray-900 font-mono bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                            />
                            <button 
                                onClick={() => dateInputRef.current?.focus()}
                                className="p-2 bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-pink-600 rounded-lg transition-colors"
                            >
                                <Calendar size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Route */}
                    <CustomSelect
                        label={t('field.route')}
                        value={route}
                        onChange={(val) => setRoute(val as Route)}
                        options={Object.values(Route).map(r => ({
                            value: r,
                            label: t(`route.${r}`),
                            icon: getRouteIcon(r)
                        }))}
                    />

                    {route === Route.patchRemove && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                            {t('beta.patch_remove')}
                        </div>
                    )}

                    {route !== Route.patchRemove && (
                        <>
                            {/* Ester Selection */}
                            {availableEsters.length > 1 && (
                                <CustomSelect
                                    label={t('field.ester')}
                                    value={ester}
                                    onChange={(val) => setEster(val as Ester)}
                                    options={availableEsters.map(e => ({
                                        value: e,
                                        label: t(`ester.${e}`),
                                    }))}
                                />
                            )}

                            {/* Gel Site Selector */}
                            {route === Route.gel && (
                                <div className="mb-4 space-y-2">
                                    <label className="block text-sm font-bold text-gray-700">{t('field.gel_site')}</label>
                                    <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium select-none">
                                        {t('gel.site_disabled')}
                                    </div>
                                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                        {t('beta.gel')}
                                    </div>
                                </div>
                            )}

                            {/* Patch Mode */}
                            {route === Route.patchApply && (
                                <div className="space-y-2">
                                    <div className="p-1 bg-gray-100 rounded-xl flex">
                                        <button 
                                            onClick={() => setPatchMode("dose")} 
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${patchMode === "dose" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
                                        >
                                            {t('field.patch_total')}
                                        </button>
                                        <button 
                                            onClick={() => setPatchMode("rate")} 
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${patchMode === "rate" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
                                        >
                                            {t('field.patch_rate')}
                                        </button>
                                    </div>
                                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                        {t('beta.patch')}
                                    </div>
                                </div>
                            )}

                            {/* Dose Inputs */}
                            {(route !== Route.patchApply || patchMode === "dose") && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        {(ester !== Ester.E2) && (
                                            <div className={`space-y-2 ${ (ester === Ester.EV && (route === Route.injection || route === Route.sublingual || route === Route.oral)) ? 'col-span-2' : '' }`}>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('field.dose_raw')}</label>
                                                <input 
                                                    type="number" inputMode="decimal"
                                                    value={rawDose} onChange={e => handleRawChange(e.target.value)} 
                                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none font-mono" 
                                                    placeholder="0.0"
                                                />
                                            </div>
                                        )}
                                        {!(ester === Ester.EV && (route === Route.injection || route === Route.sublingual || route === Route.oral)) && (
                                            <div className={`space-y-2 ${(ester === Ester.E2 && route !== Route.gel && route !== Route.oral && route !== Route.sublingual) ? "col-span-2" : ""}`}>
                                                <label className="block text-xs font-bold text-pink-400 uppercase tracking-wider">
                                                    {route === Route.patchApply ? t('field.dose_raw') : t('field.dose_e2')}
                                                </label>
                                                <input 
                                                    type="number" inputMode="decimal"
                                                    value={e2Dose} onChange={e => handleE2Change(e.target.value)} 
                                                    className="w-full p-4 bg-pink-50 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none font-bold text-pink-500 font-mono" 
                                                    placeholder="0.0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {(ester === Ester.EV && (route === Route.injection || route === Route.sublingual || route === Route.oral)) && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            {t('field.dose_e2')}: {e2Dose ? `${e2Dose} mg` : '--'}
                                        </p>
                                    )}
                                </>
                            )}

                            {route === Route.patchApply && patchMode === "rate" && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700">{t('field.patch_rate')}</label>
                                    <input type="number" inputMode="decimal" value={patchRate} onChange={e => setPatchRate(e.target.value)} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none" placeholder="e.g. 50" />
                                </div>
                            )}

                            {/* Sublingual Specifics */}
                            {route === Route.sublingual && (
                                <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-teal-800 flex items-center gap-2">
                                            <Clock size={16} /> {t('field.sl_duration')}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-teal-600">{t('field.sl_custom')}</span>
                                            <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${useCustomTheta ? 'bg-teal-500' : 'bg-gray-300'}`} onClick={() => setUseCustomTheta(!useCustomTheta)}>
                                                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${useCustomTheta ? 'translate-x-4' : ''}`} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {!useCustomTheta ? (
                                        <div className="space-y-3">
                                            <input 
                                                type="range" min="0" max="3" step="1" 
                                                value={slTier} onChange={e => setSlTier(parseInt(e.target.value))} 
                                                className="w-full h-2 bg-teal-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                                            />
                                            <div className="flex justify-between text-xs font-medium text-teal-700">
                                                <span>{t('sl.mode.quick')}</span>
                                                <span>{t('sl.mode.casual')}</span>
                                                <span>{t('sl.mode.standard')}</span>
                                                <span>{t('sl.mode.strict')}</span>
                                            </div>
                                            <div className="text-xs text-teal-600 bg-white/50 p-2 rounded-lg flex justify-between items-center">
                                                <span>Absorption θ ≈ {currentTheta.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input type="number" step="0.01" max="1" min="0" value={customTheta} onChange={e => setCustomTheta(e.target.value)} className="w-full p-3 border border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0.0 - 1.0" />
                                            <div className="text-xs text-teal-600 bg-white/50 p-2 rounded-lg flex justify-between items-center">
                                                <span>Absorption θ ≈ {activeTheta.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-teal-100">
                                        <Info className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-teal-700 leading-relaxed text-justify">
                                            {t('sl.instructions')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl">
                    <button onClick={handleSave} className="w-full py-4 bg-pink-400 text-white text-lg font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Save size={20} /> {t('btn.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ImportModal = ({ isOpen, onClose, onImportJson }: { isOpen: boolean; onClose: () => void; onImportJson: (text: string) => boolean }) => {
    const { t } = useTranslation();
    const [text, setText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) setText("");
    }, [isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const content = reader.result as string;
            if (onImportJson(content)) {
                onClose();
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const handleTextImport = () => {
        if (onImportJson(text)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-900">{t('import.title')}</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('import.text')}</label>
                        <textarea
                            className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none font-mono text-xs"
                            placeholder={t('import.paste_hint')}
                            value={text}
                            onChange={e => setText(e.target.value)}
                        />
                        <button
                            onClick={handleTextImport}
                            disabled={!text.trim()}
                            className="mt-2 w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {t('drawer.import')}
                        </button>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-bold">OR</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('import.file')}</label>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-xl hover:border-pink-300 hover:bg-pink-50 hover:text-pink-500 transition flex items-center justify-center gap-2"
                        >
                            <Upload size={20} />
                            {t('import.file_btn')}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const QRCodeModal = ({ isOpen, onClose, events, weight, onImportJson }: { isOpen: boolean; onClose: () => void; events: DoseEvent[]; weight: number; onImportJson: (payload: string) => boolean; }) => {
    const { t } = useTranslation();
    const [isEncrypted, setIsEncrypted] = useState(false);
    const [displayData, setDisplayData] = useState("");
    const [password, setPassword] = useState("");
    
    const rawDataString = useMemo(() => events.length ? JSON.stringify({ weight, events }) : '', [events, weight]);

    useEffect(() => {
        let active = true;
        const update = async () => {
            if (!isOpen || !rawDataString) {
                if (active) setDisplayData("");
                return;
            }
            if (isEncrypted) {
                const { data, password: pw } = await encryptData(rawDataString);
                if (active) {
                    setDisplayData(data);
                    setPassword(pw);
                }
            } else {
                if (active) {
                    setDisplayData(rawDataString);
                    setPassword("");
                }
            }
        };
        update();
        return () => { active = false; };
    }, [isOpen, isEncrypted, rawDataString]);

    const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setErrorMsg('');
            setIsEncrypted(false);
        }
    }, [isOpen]);

    const handleDecoded = useCallback((text: string) => {
        if (!text) {
            setErrorMsg(t('qr.error.format'));
            return;
        }
        const ok = onImportJson(text);
        if (ok) {
            setErrorMsg('');
            onClose();
        } else {
            // If onImportJson returns false, it might be because it's waiting for password (handled in AppContent)
            // But here we just want to know if it was "handled".
            // My updated importEventsFromJson returns false if encrypted (waiting for password).
            // So we should probably assume if it returns false, it might be valid but encrypted.
            // But wait, if it returns false, it shows an error dialog in the original code?
            // In my updated code:
            // if encrypted -> returns false (but opens password modal).
            // if error -> returns false (and shows error dialog).
            // So here we can't distinguish easily.
            // However, `importEventsFromJson` handles the UI for both cases.
            // So we can just close the QR modal if we think it was successful or "in progress".
            // But if it was an error, we want to show error in QR modal?
            // Let's look at `importEventsFromJson` again.
            // It shows `showDialog('alert', ...)` on error.
            // So the user will see the alert.
            // We can just close the QR modal? Or keep it open?
            // If it's encrypted, the Password Modal will appear ON TOP of the QR Modal?
            // Yes, z-index 60 vs 50.
            // So we can keep QR modal open or close it.
            // Closing it is cleaner.
            onClose();
        }
    }, [onImportJson, onClose, t]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setErrorMsg('');
        const reader = new FileReader();
        reader.onload = () => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (!canvas || !ctx) return;
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);
                if (code?.data) {
                    handleDecoded(code.data);
                } else {
                    setErrorMsg(t('qr.error.decode'));
                }
            };
            img.onerror = () => setErrorMsg(t('qr.error.decode'));
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleCopy = async () => {
        if (!displayData) return;
        try {
            await navigator.clipboard.writeText(displayData);
            setCopyState('copied');
            setTimeout(() => setCopyState('idle'), 2000);
        } catch (err) {
            console.error(err);
            setErrorMsg(t('qr.error.format'));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider">{t('qr.title')}</p>
                        <p className="text-sm text-gray-500 mt-1">{t('qr.help')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 p-6">
                    <section className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                <QrCode size={16} className="text-pink-400" />
                                {t('qr.export.title')}
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-500">{t('qr.encrypt_label')}</label>
                                <div 
                                    className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${isEncrypted ? 'bg-pink-400' : 'bg-gray-300'}`} 
                                    onClick={() => setIsEncrypted(!isEncrypted)}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${isEncrypted ? 'translate-x-4' : ''}`} />
                                </div>
                            </div>
                        </div>

                        {displayData ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="bg-white p-4 rounded-2xl shadow-sm relative">
                                    <QRCodeCanvas value={displayData} size={200} includeMargin level="M" />
                                    {isEncrypted && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <Lock className="text-pink-400/20 w-24 h-24" />
                                        </div>
                                    )}
                                </div>
                                
                                {isEncrypted && password && (
                                    <div className="w-full bg-pink-50 border border-pink-100 p-3 rounded-xl text-center">
                                        <p className="text-xs text-pink-400 font-bold uppercase mb-1">{t('export.password_title')}</p>
                                        <p className="font-mono font-bold text-gray-800 text-lg select-all">{password}</p>
                                    </div>
                                )}

                                <textarea
                                    className="w-full h-20 text-xs p-3 rounded-xl border border-gray-200 bg-white font-mono text-gray-600"
                                    readOnly
                                    value={displayData}
                                />
                                <button
                                    onClick={handleCopy}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                                >
                                    <Copy size={16} /> {copyState === 'copied' ? t('qr.copied') : t('qr.copy')}
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">{t('qr.export.empty')}</p>
                        )}
                    </section>

                    <section className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <Camera size={16} className="text-teal-500" />
                            {t('qr.import.title')}
                        </div>
                        
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <ImageIcon size={16} className="text-blue-500" />
                                {t('qr.import.file')}
                            </label>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="w-full text-sm text-gray-600" />
                            <p className="text-xs text-gray-500">{t('qr.upload.hint')}</p>
                        </div>

                        {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
                    </section>
                </div>

                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    );
};

const ResultChart = ({ sim }: { sim: SimulationResult | null }) => {
    const { t, lang } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [xDomain, setXDomain] = useState<[number, number] | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(2);
    const initializedRef = useRef(false);

    // Track pointers for touch interaction
    const lastTouchRef = useRef<{ dist: number; center: number } | null>(null);
    const lastPanRef = useRef<number | null>(null);

    const data = useMemo(() => {
        if (!sim || sim.timeH.length === 0) return [];
        return sim.timeH.map((t, i) => ({
            time: t * 3600000, 
            conc: sim.concPGmL[i]
        }));
    }, [sim]);

    const defaultDomain = useMemo(() => {
        if (data.length === 0) return null;
        const min = data[0].time;
        const max = data[data.length - 1].time;
        return [min, max] as [number, number];
    }, [data]);

    // Update domain when data loads; default to 2x view
    useEffect(() => {
        if (!initializedRef.current && data.length > 0) {
            setZoomFactor(2);
            initializedRef.current = true;
            return;
        }

        if (!isZoomed && data.length > 0 && zoomLevel !== 2) {
            setZoomFactor(2);
        }
    }, [data, isZoomed, zoomLevel]);

    const setZoomFactor = (factor: number) => {
        const now = new Date().getTime();
        if (!data.length) return;
        const min = data[0].time;
        const max = data[data.length - 1].time;
        const totalRange = Math.max(max - min, 1);
        const minWidth = 24 * 3600 * 1000;
        const width = Math.max(totalRange / Math.max(1, factor), minWidth);
        let start = now - width / 2;
        let end = now + width / 2;
        if (start < min) {
            start = min;
            end = Math.min(min + width, max);
        }
        if (end > max) {
            end = max;
            start = Math.max(max - width, min);
        }
        setXDomain([start, end]);
        setZoomLevel(factor);
        setIsZoomed(factor !== 2);
    };

    const resetZoom = () => {
        setZoomFactor(2);
        setIsZoomed(false);
    };

    // Compute total timeline and slider parameters for panning
    const totalMin = data.length > 0 ? data[0].time : 0;
    const totalMax = data.length > 0 ? data[data.length - 1].time : totalMin;
    const defaultVisibleWidth = defaultDomain ? (defaultDomain[1] - defaultDomain[0]) : (totalMax - totalMin);
    const visibleWidth = xDomain
        ? (xDomain[1] - xDomain[0])
        : (defaultVisibleWidth || totalMax - totalMin || 1);
    const sliderMin = totalMin;
    const sliderMax = Math.max(totalMax - visibleWidth, sliderMin);
    const sliderValue = xDomain ? xDomain[0] : (defaultDomain ? defaultDomain[0] : sliderMin);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        if (isNaN(v)) return;
        const start = Math.max(sliderMin, Math.min(v, sliderMax));
        const end = start + visibleWidth;
        setXDomain([start, end]);
        setIsZoomed(true);
    };

    const now = new Date().getTime();

    if (!sim || sim.timeH.length === 0) return (
        <div className="h-72 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <Activity className="w-12 h-12 mb-4 text-gray-200" strokeWidth={1.5} />
            <p className="text-sm font-medium">{t('timeline.empty')}</p>
        </div>
    );
    
    return (
        <div className="bg-white p-6 rounded-3xl shadow-lg shadow-gray-100 border border-gray-100 relative overflow-hidden group">
            <div className="flex flex-col gap-2 mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-500 tracking-wider">{t('chart.title')}</h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 shadow-inner shadow-gray-100">
                            {[2, 4, 6].map((factor) => (
                                <button
                                    key={factor}
                                    onClick={() => setZoomFactor(factor)}
                                    className="px-3 py-1 text-xs font-bold text-gray-600 rounded-lg transition-all bg-white hover:bg-pink-50 hover:text-pink-500 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                                >
                                    {factor}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {isZoomed && (
                    <button 
                        onClick={resetZoom}
                        className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold transition-all animate-in fade-in hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                    >
                        <RotateCcw size={12} /> {t('chart.reset')}
                    </button>
                )}
            </div>
            
            <div 
                ref={containerRef}
                className="h-72 w-full touch-none cursor-default"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                        <defs>
                            <linearGradient id="colorConc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f472b6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#f472b6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="time" 
                            type="number" 
                            domain={xDomain || ['auto', 'auto']}
                            allowDataOverflow={true}
                            tickFormatter={(ms) => formatDate(new Date(ms), lang)}
                            tick={{fontSize: 10, fill: '#9ca3af'}}
                            minTickGap={40}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis 
                            tick={{fontSize: 10, fill: '#9ca3af'}}
                            width={45}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            labelFormatter={(ms) => `${formatDate(new Date(ms), lang)} ${formatTime(new Date(ms))}`}
                            formatter={(value: number) => [value.toFixed(1) + " pg/mL", t('chart.tooltip.conc')]}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                            itemStyle={{ color: '#f472b6', fontWeight: 'bold' }}
                            labelStyle={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px' }}
                        />
                        <ReferenceLine x={now} stroke="#f9a8d4" strokeDasharray="3 3" label={{ value: t('chart.now'), fill: '#f9a8d4', fontSize: 10, position: 'insideTopLeft' }} />
                        <Area type="monotone" dataKey="conc" stroke="#f472b6" strokeWidth={3} fillOpacity={1} fill="url(#colorConc)" activeDot={{ r: 6, strokeWidth: 0 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Timeline slider for quick panning */}
            {data.length > 1 && (
                <div className="px-2 mt-3">
                    <input
                        type="range"
                        min={String(sliderMin)}
                        max={String(sliderMax)}
                        value={String(sliderValue)}
                        onChange={handleSliderChange}
                        disabled={sliderMax <= sliderMin}
                        className="w-full accent-pink-400"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{formatDate(new Date(sliderValue), lang)}</span>
                        <span>{formatDate(new Date(sliderValue + visibleWidth), lang)}</span>
                    </div>
                </div>
            )}
            
            {/* Visual hint for zoom availability (fades out) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                <ZoomIn className="w-16 h-16 text-gray-300" />
            </div>
        </div>
    );
};

// --- Main App ---

const AppContent = () => {
    const { t, lang, setLang } = useTranslation();
    const { showDialog } = useDialog();

    const [events, setEvents] = useState<DoseEvent[]>(() => {
        const saved = localStorage.getItem('hrt-events');
        return saved ? JSON.parse(saved) : [];
    });
    const [weight, setWeight] = useState<number>(() => {
        const saved = localStorage.getItem('hrt-weight');
        return saved ? parseFloat(saved) : 70.0;
    });

    const [simulation, setSimulation] = useState<SimulationResult | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<DoseEvent | null>(null);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState("");
    const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = useState(false);
    const [isPasswordInputOpen, setIsPasswordInputOpen] = useState(false);

    const [currentView, setCurrentView] = useState<'home' | 'history' | 'settings'>('home');
    const mainScrollRef = useRef<HTMLDivElement>(null);

    const languageOptions = useMemo(() => ([
        { value: 'zh', label: '简体中文', icon: <span className="text-lg" role="img" aria-label="CN">🇨🇳</span> },
        { value: 'zh-TW', label: '正體中文', icon: <span className="text-lg" role="img" aria-label="TW">🤔</span> },
        { value: 'yue', label: '粵語', icon: <span className="text-lg" role="img" aria-label="HK">🇭🇰</span> },
        { value: 'en', label: 'English', icon: <span className="text-lg" role="img" aria-label="US">🇺🇸</span> },
        { value: 'ru', label: 'Русский', icon: <span className="text-lg" role="img" aria-label="RU">🇷🇺</span> },
        { value: 'uk', label: 'Українська', icon: <span className="text-lg" role="img" aria-label="UA">🇺🇦</span> },
    ]), []);

    useEffect(() => {
        const shouldLock = isExportModalOpen || isPasswordDisplayOpen || isPasswordInputOpen || isWeightModalOpen || isFormOpen || isQrModalOpen || isImportModalOpen;
        document.body.style.overflow = shouldLock ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isExportModalOpen, isPasswordDisplayOpen, isPasswordInputOpen, isWeightModalOpen, isFormOpen, isQrModalOpen, isImportModalOpen]);
    const [pendingImportText, setPendingImportText] = useState<string | null>(null);

    useEffect(() => { localStorage.setItem('hrt-events', JSON.stringify(events)); }, [events]);
    useEffect(() => { localStorage.setItem('hrt-weight', weight.toString()); }, [weight]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Reset scroll when switching tabs to avoid carrying over deep scroll positions
    useEffect(() => {
        const el = mainScrollRef.current;
        if (el) el.scrollTo({ top: 0, behavior: 'auto' });
    }, [currentView]);

    useEffect(() => {
        if (events.length > 0) {
            const res = runSimulation(events, weight);
            setSimulation(res);
        } else {
            setSimulation(null);
        }
    }, [events, weight]);

    const currentLevel = useMemo(() => {
        if (!simulation) return 0;
        const h = currentTime.getTime() / 3600000;
        return interpolateConcentration(simulation, h) || 0;
    }, [simulation, currentTime]);

    const groupedEvents = useMemo(() => {
        const sorted = [...events].sort((a, b) => b.timeH - a.timeH);
        const groups: Record<string, DoseEvent[]> = {};
        sorted.forEach(e => {
            const d = formatDate(new Date(e.timeH * 3600000), lang);
            if (!groups[d]) groups[d] = [];
            groups[d].push(e);
        });
        return groups;
    }, [events, lang]);

    const sanitizeImportedEvents = (raw: any): DoseEvent[] => {
        if (!Array.isArray(raw)) throw new Error('Invalid format');
        return raw
            .map((item: any) => {
                if (!item || typeof item !== 'object') return null;
                const { route, timeH, doseMG, ester, extras } = item;
                if (!Object.values(Route).includes(route)) return null;
                const timeNum = Number(timeH);
                if (!Number.isFinite(timeNum)) return null;
                const doseNum = Number(doseMG);
                const validEster = Object.values(Ester).includes(ester) ? ester : Ester.E2;
                const sanitizedExtras = (extras && typeof extras === 'object') ? extras : {};
                return {
                    id: typeof item.id === 'string' ? item.id : uuidv4(),
                    route,
                    timeH: timeNum,
                    doseMG: Number.isFinite(doseNum) ? doseNum : 0,
                    ester: validEster,
                    extras: sanitizedExtras
                } as DoseEvent;
            })
            .filter((item): item is DoseEvent => item !== null);
    };

    const processImportedData = (parsed: any): boolean => {
        try {
            let newEvents: DoseEvent[] = [];
            let newWeight: number | undefined = undefined;

            if (Array.isArray(parsed)) {
                newEvents = sanitizeImportedEvents(parsed);
            } else if (typeof parsed === 'object' && parsed !== null) {
                if (Array.isArray(parsed.events)) {
                    newEvents = sanitizeImportedEvents(parsed.events);
                }
                if (typeof parsed.weight === 'number' && parsed.weight > 0) {
                    newWeight = parsed.weight;
                }
            }

            if (!newEvents.length && !newWeight) throw new Error('No valid entries');
            
            if (newEvents.length > 0) setEvents(newEvents);
            if (newWeight !== undefined) setWeight(newWeight);

            showDialog('alert', t('drawer.import_success'));
            return true;
        } catch (err) {
             console.error(err);
             showDialog('alert', t('drawer.import_error'));
             return false;
        }
    };

    const importEventsFromJson = (text: string): boolean => {
        try {
            const parsed = JSON.parse(text);
            
            if (parsed.encrypted && parsed.iv && parsed.salt && parsed.data) {
                setPendingImportText(text);
                setIsPasswordInputOpen(true);
                return true; 
            }

            return processImportedData(parsed);
        } catch (err) {
            console.error(err);
            showDialog('alert', t('drawer.import_error'));
            return false;
        }
    };

    const handleAddEvent = () => {
        setEditingEvent(null);
        setIsFormOpen(true);
    };

    const handleEditEvent = (e: DoseEvent) => {
        setEditingEvent(e);
        setIsFormOpen(true);
    };

    const handleSaveEvent = (e: DoseEvent) => {
        setEvents(prev => {
            const exists = prev.find(p => p.id === e.id);
            if (exists) {
                return prev.map(p => p.id === e.id ? e : p);
            }
            return [...prev, e];
        });
    };

    const handleDeleteEvent = (id: string) => {
        showDialog('confirm', t('timeline.delete_confirm'), () => {
            setEvents(prev => prev.filter(e => e.id !== id));
        });
    };

    const handleClearAllEvents = () => {
        if (!events.length) return;
        showDialog('confirm', t('drawer.clear_confirm'), () => {
            setEvents([]);
        });
    };

    const handleSaveDosages = () => {
        if (events.length === 0) {
            showDialog('alert', t('drawer.empty_export'));
            return;
        }
        setIsExportModalOpen(true);
    };

    const downloadFile = (data: string, filename: string) => {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleExportConfirm = async (encrypt: boolean) => {
        setIsExportModalOpen(false);
        const exportData = {
            meta: { version: 1, exportedAt: new Date().toISOString() },
            weight: weight,
            events: events
        };
        const json = JSON.stringify(exportData, null, 2);
        
        if (encrypt) {
            const { data, password } = await encryptData(json);
            setGeneratedPassword(password);
            setIsPasswordDisplayOpen(true);
            downloadFile(data, `hrt-dosages-encrypted-${new Date().toISOString().split('T')[0]}.json`);
        } else {
            downloadFile(json, `hrt-dosages-${new Date().toISOString().split('T')[0]}.json`);
        }
    };

    const handlePasswordSubmit = async (password: string) => {
        if (!pendingImportText) return;
        const decrypted = await decryptData(pendingImportText, password);
        if (decrypted) {
            setIsPasswordInputOpen(false);
            setPendingImportText(null);
            try {
                const parsed = JSON.parse(decrypted);
                processImportedData(parsed);
            } catch (e) {
                showDialog('alert', t('import.decrypt_error'));
            }
        } else {
            showDialog('alert', t('import.decrypt_error'));
        }
    };

    return (
        <div className="h-screen w-full bg-white flex flex-col font-sans text-gray-900 select-none overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden w-full max-w-lg mx-auto bg-white shadow-2xl">
                {/* Header */}
                {currentView === 'home' && (
                    <header className="bg-white px-8 pt-12 pb-8 rounded-b-[2.5rem] shadow-xl shadow-gray-100 z-10 sticky top-0">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('status.estimate')}</h1>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-6xl font-black text-gray-900 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
                                        {currentLevel.toFixed(0)}
                                    </span>
                                    <span className="text-xl font-bold text-gray-400">pg/mL</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 items-end" />
                        </div>
                        <div className="flex gap-4">
                             <button onClick={() => setIsWeightModalOpen(true)} className="flex items-center gap-2 bg-gray-50 pl-3 pr-4 py-2 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-100 transition">
                                <Settings size={16} className="text-gray-400" />
                                {t('status.weight')}: {weight} kg
                            </button>
                        </div>
                    </header>
                )}

                <main ref={mainScrollRef} className="flex-1 overflow-y-auto bg-white w-full scrollbar-hide px-6 py-8">
                    {/* Chart */}
                    {currentView === 'home' && (
                        <ResultChart sim={simulation} />
                    )}

                    {/* Timeline */}
                    {currentView === 'history' && (
                        <div className="space-y-6 pt-8">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                   <Activity size={24} className="text-pink-400" /> {t('timeline.title')}
                                </h2>
                                <button 
                                    onClick={handleAddEvent}
                                    className="bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg shadow-gray-900/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
                                >
                                    <Plus size={16} />
                                    <span className="font-bold text-sm">{t('btn.add')}</span>
                                </button>
                            </div>

                            {Object.keys(groupedEvents).length === 0 && (
                                <div className="text-center py-12 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                                   <p>{t('timeline.empty')}</p>
                                </div>
                            )}

                            {Object.entries(groupedEvents).map(([date, items]) => (
                                <div key={date} className="relative">
                                    <div className="sticky top-0 bg-gray-50/95 backdrop-blur py-2 px-2 z-0 flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-pink-200"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{date}</span>
                                    </div>
                                    <div className="space-y-3">
                                        {(items as DoseEvent[]).map(ev => (
                                            <div 
                                                key={ev.id} 
                                                onClick={() => handleEditEvent(ev)}
                                                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md hover:border-pink-100 transition-all cursor-pointer group relative overflow-hidden"
                                            >
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${ev.route === Route.injection ? 'bg-pink-50' : 'bg-gray-50'}`}>
                                                    {getRouteIcon(ev.route)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-gray-900 text-sm truncate">
                                                            {ev.route === Route.patchRemove ? t('route.patchRemove') : t(`ester.${ev.ester}`)}
                                                        </span>
                                                        <span className="font-mono text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                                                            {formatTime(new Date(ev.timeH * 3600000))}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-medium space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate">{t(`route.${ev.route}`)}</span>
                                                            {ev.extras[ExtraKey.releaseRateUGPerDay] && (
                                                                <>
                                                                    <span className="text-gray-300">•</span>
                                                                    <span className="text-gray-700">{`${ev.extras[ExtraKey.releaseRateUGPerDay]} µg/d`}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {ev.route !== Route.patchRemove && !ev.extras[ExtraKey.releaseRateUGPerDay] && (
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-700">
                                                                <span>{`${t('timeline.dose_label')}: ${ev.doseMG.toFixed(2)} mg`}</span>
                                                                {ev.ester !== Ester.E2 && (
                                                                    <span className="text-gray-500 text-xs">
                                                                        {`(${ (ev.doseMG * getToE2Factor(ev.ester)).toFixed(2) } mg E2)`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} 
                                                    className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={18} className="text-pink-400 hover:text-pink-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Settings */}
                    {currentView === 'settings' && (
                        <div className="space-y-8 pt-4">
                            <div className="px-2">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                    <Settings size={24} className="text-pink-400" /> {t('nav.settings')}
                                </h2>
                            </div>

                            {/* General Settings */}
                            <div className="space-y-3">
                                <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('settings.group.general')}</h3>
                                <div className="w-full p-4 rounded-2xl border border-gray-200 bg-white space-y-3">
                                    <div className="flex items-start gap-3">
                                        <Languages className="text-blue-500" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.lang')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.lang_hint')}</p>
                                        </div>
                                        <div className="ml-auto text-xs font-bold text-gray-500">{lang.toUpperCase()}</div>
                                    </div>
                                    <CustomSelect
                                        value={lang}
                                        onChange={(val) => setLang(val as Lang)}
                                        options={languageOptions}
                                    />
                                </div>
                            </div>

                            {/* Data Management */}
                            <div className="space-y-3">
                                <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('settings.group.data')}</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={handleSaveDosages}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-pink-200 hover:bg-pink-50 transition bg-white"
                                    >
                                        <Download className="text-pink-400" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.save')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.save_hint')}</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setIsImportModalOpen(true)}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-teal-200 hover:bg-teal-50 transition bg-white"
                                    >
                                        <Upload className="text-teal-500" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.import')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.import_hint')}</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setIsQrModalOpen(true)}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 transition bg-white"
                                    >
                                        <QrCode className="text-indigo-500" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.qr')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.qr_hint')}</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={handleClearAllEvents}
                                        disabled={!events.length}
                                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition bg-white ${events.length ? 'border-gray-200 hover:border-red-200 hover:bg-red-50' : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'}`}
                                    >
                                        <Trash2 className="text-red-400" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.clear')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.clear_confirm')}</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* About */}
                            <div className="space-y-3">
                                <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('settings.group.about')}</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            showDialog('confirm', t('drawer.model_confirm'), () => {
                                                window.open('https://misaka23323.com/articles/estrogen-model-summary', '_blank');
                                            });
                                        }}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-purple-200 hover:bg-purple-50 transition bg-white"
                                    >
                                        <Info className="text-purple-500" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.model_title')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.model_desc')}</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            showDialog('confirm', t('drawer.github_confirm'), () => {
                                                window.open('https://github.com/SmirnovaOyama/Oyama-s-HRT-recorder', '_blank');
                                            });
                                        }}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-gray-800 hover:bg-gray-50 transition bg-white"
                                    >
                                        <Github className="text-gray-700" size={20} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{t('drawer.github')}</p>
                                            <p className="text-xs text-gray-500">{t('drawer.github_desc')}</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Version Footer */}
                            <div className="pt-4 pb-8 flex justify-center">
                                <p className="text-xs font-medium text-gray-300">
                                    {APP_VERSION}
                                </p>
                            </div>
                        </div>
                    )}
                </main>

                {/* Bottom Navigation */}
                <nav className="bg-white border-t border-gray-100 px-6 py-4 flex justify-around items-center z-20 safe-area-pb shrink-0">
                    <button 
                        onClick={() => setCurrentView('home')}
                        className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'home' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Activity size={24} />
                        <span className="text-xs font-bold">{t('nav.home')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView('history')}
                        className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'history' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Calendar size={24} />
                        <span className="text-xs font-bold">{t('nav.history')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView('settings')}
                        className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'settings' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Settings size={24} />
                        <span className="text-xs font-bold">{t('nav.settings')}</span>
                    </button>
                </nav>
            </div>

            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={handleExportConfirm}
            />

            <PasswordDisplayModal
                isOpen={isPasswordDisplayOpen}
                onClose={() => setIsPasswordDisplayOpen(false)}
                password={generatedPassword}
            />

            <PasswordInputModal
                isOpen={isPasswordInputOpen}
                onClose={() => setIsPasswordInputOpen(false)}
                onConfirm={handlePasswordSubmit}
            />

            <WeightEditorModal 
                isOpen={isWeightModalOpen} 
                onClose={() => setIsWeightModalOpen(false)} 
                currentWeight={weight} 
                onSave={setWeight} 
            />
            
            <DoseFormModal 
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                eventToEdit={editingEvent}
                onSave={handleSaveEvent}
            />

            <QRCodeModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                events={events}
                weight={weight}
                onImportJson={(payload) => importEventsFromJson(payload)}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportJson={(payload) => {
                    const ok = importEventsFromJson(payload);
                    return ok;
                }}
            />
        </div>
    );
};

const App = () => (
    <LanguageProvider>
        <DialogProvider>
            <AppContent />
        </DialogProvider>
    </LanguageProvider>
);

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
