// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
const { createClient } = supabase;
const supabaseUrl = 'https://gxfvjmuzxzpghlbzzmui.supabase.co';
const supabaseKey = 'sb_publishable_DOH0iHUCDzDwObAjujD0vA_sSM1-49V';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

let sessionUser = null;
let db = { remates: [] };
let checkedNodes = [];
let clientDB = [];
let clientesLatentes = [];
let feedbackMessages = [];
let currentModalPujas = [];
let currentAdjudicadoModal = null;
let currentFiltroModal = 'todos';
let dashChartVentasInst = null;
let dashChartClientesInst = null;
let biChartSegmentsInst = null;
let flotaMarcasInst = null;
let flotaAniosInst = null;
let retailCategoriasInst = null;
let retailSubcategoriasInst = null;
let compChartInst = null;
let currentModule = 'remates';
let globalMapCMulti = {};
let globalAgg = null;
let currentGestorYearTab = null;
let currentProductosTab = 'siniestrados';

// ESTADO FILTRO GLOBAL
window.globalSelectedYears = [];
window.expandedDropMonths = new Set();

// ============================================================
// VARIABLES PARA BONOS DE GESTIÓN
// ============================================================
let historialBonos = [];
let bonoActual = null;

const METAS_BONOS = {
    ganadores: 18,
    pujadores: 42,
    garantes: 51,
    ventas: 5
};

// ============================================================
// INICIALIZACIÓN DE CHART.JS
// ============================================================
if(typeof Chart !== 'undefined') {
    Chart.defaults.color = '#6B7280';
    Chart.defaults.font.family = 'Roboto, sans-serif';
    Chart.defaults.font.size = 11;
}

// ============================================================
// FUNCIONES DE AUTENTICACIÓN Y SINCRONIZACIÓN
// ============================================================
window.actualizarEstadoApp = function(keepGestorScroll = false) {
    window.renderDropdownUI();
    window.updateDropdownLabel();
    window.updateAdminButtonCount();
    window.renderApp();

    const modalGestor = document.getElementById('modal-gestor');
    if(modalGestor && !modalGestor.classList.contains('hidden')) {
        window.abrirModalGestor(keepGestorScroll);
    }
};

window.actualizarVistaActual = function() {
    window.renderApp();
};

window.toggleSidebar = function(e) {
    if(e) e.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
};

window.closeMenus = function(e) {
    const dropdown = document.getElementById('dropdown-menu');
    const container = document.getElementById('dropdown-container');
    if(dropdown && !dropdown.classList.contains('hidden')) {
        if(!container.contains(e.target)) {
            dropdown.classList.add('hidden');
            dropdown.classList.remove('flex');
        }
    }
};

async function checkSession() {
    try {
        const timeoutP = new Promise((_, r) => setTimeout(() => r(new Error("Timeout Supabase")), 7000));
        const sessionP = supabaseClient.auth.getSession();
        const { data, error } = await Promise.race([sessionP, timeoutP]);
        if (error) throw error;

        if (data && data.session) {
            sessionUser = data.session.user;
            const displayEl = document.getElementById('user-display-email');
            if(displayEl) {
                displayEl.innerText = sessionUser.email.substring(0,12) + "...";
            }

            const esAdmin = sessionUser.email.toLowerCase() === 'pabloaat@gmail.com';
            const adminControls = document.getElementById('admin-controls');
            if (adminControls) {
                if (esAdmin) {
                    adminControls.classList.remove('hidden');
                    adminControls.classList.add('flex');
                } else {
                    adminControls.classList.add('hidden');
                    adminControls.classList.remove('flex');
                }
            }

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-content').classList.remove('hidden');
            document.getElementById('app-content').classList.add('flex');

            document.getElementById('app-content').classList.remove('hidden');
            document.getElementById('app-content').classList.add('flex');
            initApp();
        } else {
            document.getElementById('loading-overlay').classList.add('hidden');
            document.getElementById('loading-overlay').classList.remove('flex');

            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-content').classList.add('hidden');
            document.getElementById('app-content').classList.remove('flex');
            const btn = document.getElementById('btn-login');
            if(btn) {
                btn.innerHTML = "Ingresar al Panel";
                btn.disabled = false;
            }
        }
    } catch(e) {
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('loading-overlay').classList.remove('flex');

        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-content').classList.add('hidden');
        document.getElementById('app-content').classList.remove('flex');
        const err = document.getElementById('login-error');
        if(err) {
            err.innerText = "Error: " + e.message;
            err.classList.remove('hidden');
        }
    }
}

window.handleLogin = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('login-error');
    btn.innerHTML = "Validando...";
    btn.disabled = true;
    err.classList.add('hidden');

    try {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data && !data.session) throw new Error("Cuenta inactiva.");
        btn.innerHTML = "Abriendo...";

        document.getElementById('loading-overlay').classList.remove('hidden');
        document.getElementById('loading-overlay').classList.add('flex');

        await checkSession();
    } catch (ex) {
        let msj = ex.message || "Error desconocido";
        if(msj.includes("Email not confirmed")) msj = "Cuenta requiere confirmación en BD.";
        if(msj.includes("Invalid login")) msj = "Credenciales incorrectas.";
        err.innerText = msj;
        err.classList.remove('hidden');
        btn.innerHTML = "Ingresar al Panel";
        btn.disabled = false;

        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('loading-overlay').classList.remove('flex');
    }
};

window.onload = () => {
    checkSession();
};

window.handleLogout = async function() {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

// ============================================================
// FUNCIONES DE FORMATEO
// ============================================================
window.formatearNombreRemate = function(fileName, timestamp) {
    try {
        if(!fileName || typeof fileName !== 'string') fileName = "Matriz Desconocida";
        let numMatch = fileName.match(/(?:REMATE|ZARATE).*?(\d{3,5})/i) || fileName.match(/\b(\d{4})\b/);
        let num = numMatch ? (numMatch[1] || numMatch[0]) : '';
        let dateStr = '';
        if (timestamp && !isNaN(timestamp)) {
            let d = new Date(timestamp);
            let dd = String(d.getDate()).padStart(2, '0');
            let mm = String(d.getMonth() + 1).padStart(2, '0');
            let yyyy = d.getFullYear();
            dateStr = `${dd}/${mm}/${yyyy}`;
        }
        if(num && dateStr) return `Remate ${num} (${dateStr})`;
        if(num) return `Remate ${num}`;
        let base = fileName.replace(/\.xlsx?$|\.xls$/i,'').substring(0,18);
        return dateStr ? `${base} (${dateStr})` : base;
    } catch(e) {
        return "Matriz";
    }
};

function formatMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    const num = Math.round(Number(n));
    return '$' + num.toLocaleString('es-CL');
}

window.formatExcelDate = function(ts) {
    if (!ts || isNaN(ts)) return '-';
    try {
        const d = new Date(Number(ts));
        if (isNaN(d.getTime())) return '-';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch (e) {
        return '-';
    }
};

function getSelectedRemates() {
    if (!db || !db.remates || !checkedNodes) return [];
    return db.remates.filter(r => checkedNodes.includes(r.id));
}

function normalizarCliente(nombre) {
    if (!nombre) return '';
    return String(nombre)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function esClienteFalso(nombre, email) {
    if (!nombre && !email) return true;

    // Normalize string: to lowercase, remove accents, and strip punctuation/extra spaces
    const normalizeString = (str) => {
        return String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
    };

    const nNorm = normalizeString(nombre);
    const eNorm = normalizeString(email);
    const eRaw = String(email || '').toLowerCase().trim();

    // Check for short meaningless entries (<= 2 characters or repeated single characters)
    if (nNorm.length <= 2) return true;
    if (/^([a-z0-9])\1+$/.test(nNorm) && nNorm.length <= 3) return true;

    const falsos = [
        'zarate', 'prueba', 'test', 'interno', 'admin',
        'sistema', 'demo', 'falso', 'noadjudicado', 'sinadjudicar',
        'casamatriz', 'casaderemate', 'rematadora', 'clienteprueba', 'clientegenerico',
        'rz'
    ];

    for (const f of falsos) {
        if (nNorm.includes(f) || eNorm.includes(f)) return true;
    }

    const dominiosFalsos = ['@zarate', 'zarate.cl', '@plataforma', '@test', '@remate', 'noreply', 'no-reply'];
    for (const d of dominiosFalsos) {
        if (eRaw.includes(d)) return true;
    }

    return false;
}

function extraerMarcaModelo(texto) {
    if (!texto || typeof texto !== 'string') {
        return { categoria: 'SIN MARCA', modeloStr: '' };
    }

    const t = texto.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const marcas = [
        'TOYOTA', 'CHEVROLET', 'NISSAN', 'HYUNDAI', 'KIA', 'SUZUKI',
        'FORD', 'MAZDA', 'VOLKSWAGEN', 'VW', 'PEUGEOT', 'RENAULT',
        'CITROEN', 'CITROËN', 'FIAT', 'JEEP', 'MITSUBISHI', 'HONDA',
        'SUBARU', 'BMW', 'MERCEDES', 'AUDI', 'VOLVO', 'SSANGYONG',
        'GREAT WALL', 'CHERY', 'MG', 'JAC', 'BYD',
        'RAM', 'DODGE', 'CHRYSLER', 'ISUZU', 'MAXUS', 'DFSK',
        'FOTON', 'HAVAL', 'GEELY', 'CHANGAN', 'DONGFENG', 'FAW',
        'SKODA', 'SEAT', 'OPEL', 'LAND ROVER', 'JAGUAR', 'PORSCHE',
        'MINI', 'SMART', 'DAIHATSU', 'LADA', 'PROTON', 'TATA',
        'MAHINDRA', 'BAIC', 'GWM', 'ORA', 'ZEEKR'
    ];

    let categoria = 'OTROS';
    let modeloStr = t;

    for (const marca of marcas) {
        if (t.includes(marca)) {
            categoria = marca === 'VW' ? 'VOLKSWAGEN' : marca;
            modeloStr = t.replace(new RegExp(marca, 'g'), '').replace(/\s+/g, ' ').trim();
            break;
        }
    }

    if (modeloStr.length > 40) {
        modeloStr = modeloStr.substring(0, 40).trim();
    }

    if (!modeloStr) modeloStr = '';

    return { categoria, modeloStr };
}

// ============================================================
// EXTRACCIÓN DE FECHA (MEJORADO PARA RETAIL)
// ============================================================
function extraerFechaInfo(file, rowsAdj) {
    let year = new Date().getFullYear();
    let timestamp = Date.now();

    const name = (file && file.name) ? file.name : '';

    let m = name.match(/(\d{1,2})[\/\-_\.](\d{1,2})[\/\-_\.](\d{4})/);
    if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        if (y >= 2015 && y <= 2035 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
            const dt = new Date(y, mo, d, 12, 0, 0);
            if (!isNaN(dt.getTime())) {
                return { year: y, timestamp: dt.getTime(), source: 'filename' };
            }
        }
    }

    m = name.match(/(\d{4})[\/\-_\.](\d{1,2})[\/\-_\.](\d{1,2})/);
    if (m) {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        if (y >= 2015 && y <= 2035 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
            const dt = new Date(y, mo, d, 12, 0, 0);
            if (!isNaN(dt.getTime())) {
                return { year: y, timestamp: dt.getTime(), source: 'filename' };
            }
        }
    }

    m = name.match(/(20[1-3]\d)/);
    if (m) {
        year = parseInt(m[1], 10);
        timestamp = new Date(year, 5, 15, 12, 0, 0).getTime();
        return { year, timestamp, source: 'filename-year' };
    }

    if (rowsAdj && Array.isArray(rowsAdj)) {
        for (let i = 0; i < Math.min(rowsAdj.length, 20); i++) {
            const row = rowsAdj[i];
            if (!row || !Array.isArray(row)) continue;
            for (const cell of row) {
                if (cell === null || cell === undefined || cell === '') continue;

                if (typeof cell === 'number' && cell > 40000 && cell < 60000) {
                    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                    const dt = new Date(excelEpoch.getTime() + cell * 86400000);
                    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2015 && dt.getFullYear() <= 2035) {
                        return { year: dt.getFullYear(), timestamp: dt.getTime(), source: 'excel-serial' };
                    }
                }

                const s = String(cell);
                let dm = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                if (dm) {
                    const y = parseInt(dm[1], 10);
                    const mo = parseInt(dm[2], 10) - 1;
                    const d = parseInt(dm[3], 10);
                    if (y >= 2015 && y <= 2035 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
                        const dt = new Date(y, mo, d, 12, 0, 0);
                        if (!isNaN(dt.getTime())) {
                            return { year: y, timestamp: dt.getTime(), source: 'excel-text' };
                        }
                    }
                }

                dm = s.match(/(\d{1,2})[\/\-_\.](\d{1,2})[\/\-_\.](\d{4})/);
                if (dm) {
                    const d = parseInt(dm[1], 10);
                    const mo = parseInt(dm[2], 10) - 1;
                    const y = parseInt(dm[3], 10);
                    if (y >= 2015 && y <= 2035 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
                        const dt = new Date(y, mo, d, 12, 0, 0);
                        if (!isNaN(dt.getTime())) {
                            return { year: y, timestamp: dt.getTime(), source: 'excel-text' };
                        }
                    }
                }
            }
        }
    }

    if (file && file.lastModified) {
        const dt = new Date(file.lastModified);
        if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2015) {
            return { year: dt.getFullYear(), timestamp: dt.getTime(), source: 'file-mtime' };
        }
    }

    return { year, timestamp, source: 'default' };
}

// ============================================================
// INICIO DE LA APLICACIÓN
// ============================================================
async function initApp() {
    const statusLabel = document.getElementById('db-status');
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');

    try {
        statusLabel.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Sincronizando...';
        const { data, error } = await supabaseClient.from('app_state').select('*');

        if (data && data.length > 0) {
            if (data.length === 1 && data[0].payload && data[0].payload.remates) {
                db = data[0].payload;
            } else {
                db.remates = data.map(row => {
                    let r = row.payload;
                    r._dbId = row.id;
                    return r;
                });
            }
            db.remates.forEach(r => {
                if (!r.id) {
                    r.id = 'UID-' + window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp).replace(/[^a-zA-Z0-9]/g, '');
                }
            });
            statusLabel.innerHTML = `<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> En Línea (${db.remates.length})`;
        } else {
            statusLabel.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Base Vacía';
        }
    } catch (e) {
        statusLabel.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Error BD';
    } finally {
        loadingOverlay.classList.add('hidden');
        loadingOverlay.classList.remove('flex');
    }

    if(db.remates && db.remates.length > 0) {
        window.actualizarFiltrosGlobales(true);
    }
}

window.updateAdminButtonCount = function() {
    const btnCount = document.getElementById('count-matrices-btn');
    if (btnCount) {
        btnCount.innerText = checkedNodes.length;
    }
};

// ============================================================
// FILTROS GLOBALES
// ============================================================
window.actualizarFiltrosGlobales = function(isInitialLoad = false) {
    if(!db.remates || !db.remates.length) return;

    let segments = new Set();
    db.remates.forEach(r => {
        segments.add(r.tipo || 'Desconocido');
    });

    let segSelect = document.getElementById('macro-segment');
    let currentSeg = segSelect.value || Array.from(segments)[0];

    let optionsHtml = `<option value="Todos">📊 Segmentos: Todos</option>`;
    segments.forEach(s => {
        optionsHtml += `<option value="${s}" ${s === currentSeg ? 'selected' : ''}>${s}</option>`;
    });

    segSelect.innerHTML = optionsHtml;

    if(isInitialLoad) {
        let years = new Set();
        db.remates.forEach(r => {
            let y = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
            if(!isNaN(y)) years.add(y);
        });

        let maxYear = Math.max(...Array.from(years));
        window.globalSelectedYears = [maxYear];

        let initialRemates = db.remates.filter(r => {
            let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
            let matchSeg = currentSeg === 'Todos' || r.tipo === currentSeg;
            return matchSeg && rYr === maxYear;
        }).map(r => r.id);

        checkedNodes = initialRemates;
    }

    window.actualizarEstadoApp();
};

window.aplicarCambioSegmento = function() {
    window.quickSelect('TODO');
}

// ============================================================
// DROPDOWN Y FILTROS
// ============================================================
window.toggleDropdown = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropdown-menu');
    if(menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        menu.classList.add('flex');
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
};

window.renderDropdownUI = function() {
    let years = new Set();
    db.remates.forEach(r => {
        let y = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
        if(!isNaN(y)) years.add(y);
    });

    let yearsArr = Array.from(years).sort((a,b)=>b-a);

    let yearsHtml = '';
    yearsArr.forEach(y => {
        let isChecked = window.globalSelectedYears.includes(Number(y)) ? 'checked' : '';
        let activeClass = isChecked ? 'bg-[#111827] text-white border-black' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200';
        yearsHtml += `
        <label class="flex items-center gap-2 cursor-pointer rounded-full px-4 py-1.5 transition justify-center border shadow-sm ${activeClass}">
            <input type="checkbox" value="${y}" class="hidden" onchange="window.toggleTimeYear(${y}, this.checked)" ${isChecked}>
            <span class="text-[12px] font-bold">Año ${y}</span>
        </label>`;
    });
    const tyc = document.getElementById('dropdown-years-grid');
    if(tyc) {
        tyc.innerHTML = yearsHtml;
    }

    let seg = document.getElementById('macro-segment').value;
    let rematesFiltrados = db.remates.filter(r => seg === 'Todos' || r.tipo === seg);

    let byYear = {};
    rematesFiltrados.forEach(r => {
        let y = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
        if(!byYear[y]) byYear[y] = {};

        let m = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0;
        if(!byYear[y][m]) byYear[y][m] = [];

        byYear[y][m].push(r);
    });

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let html = '';

    Object.keys(byYear).sort((a,b)=>b-a).forEach(y => {
        if(!window.globalSelectedYears.includes(Number(y))) return;

        html += `<div class="mb-3 dropdown-year-group">`;

        Object.keys(byYear[y]).sort((a,b)=>a-b).forEach(m => {
            let rematesMes = byYear[y][m].sort((a,b)=> (a.fechaData?.timestamp||0) - (b.fechaData?.timestamp||0));
            let allChecked = rematesMes.every(r => checkedNodes.includes(r.id));
            let someChecked = rematesMes.some(r => checkedNodes.includes(r.id));

            let dropId = `drop-${y}-${m}`;
            let isExpanded = window.expandedDropMonths.has(dropId);
            let hiddenClass = isExpanded ? '' : 'hidden';
            let arrowClass = isExpanded ? 'rotate-90' : '';

            html += `
            <div class="dropdown-month-group border border-gray-100 rounded-lg mb-2">
                <div class="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-t-lg group">
                    <label class="flex items-center gap-2 cursor-pointer flex-1">
                        <span class="text-[12px] font-bold text-gray-800 flex items-center gap-1 group-hover:text-black transition" data-search="${monthNames[m]}" onclick="window.toggleDropExpand('${dropId}')">
                            <span class="inline-block transition-transform text-[10px] text-gray-400 ${arrowClass}">▶</span> ${monthNames[m]} <span class="text-[10px] text-gray-400 font-normal">(${rematesMes.length})</span>
                        </span>
                    </label>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-400 font-medium">${rematesMes.filter(r => checkedNodes.includes(r.id)).length}/${rematesMes.length}</span>
                        <input type="checkbox" onchange="window.toggleDropMes(this, ${y}, ${m})" ${allChecked ? 'checked' : ''} class="${someChecked && !allChecked ? 'opacity-50' : ''} !w-3.5 !h-3.5">
                    </div>
                </div>
                <div id="${dropId}" class="${hiddenClass} pl-6 pr-2 pb-2 pt-1 space-y-1">
                    ${rematesMes.map(r => {
                        let isChecked = checkedNodes.includes(r.id);
                        let rName = window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp);
                        return `
                        <label class="dropdown-remate-item flex items-center gap-2 cursor-pointer py-0.5 group">
                            <input type="checkbox" onchange="window.toggleDropRemate(this, '${r.id}')" ${isChecked ? 'checked' : ''} class="!w-3.5 !h-3.5">
                            <span class="text-[12px] font-medium text-gray-600 group-hover:text-black transition truncate" data-search="${rName}" title="${rName}">${rName}</span>
                        </label>
                        `;
                    }).join('')}
                </div>
            </div>`;
        });
        html += `</div>`;
    });

    if(window.globalSelectedYears.length === 0) {
        html = '<p class="text-center text-[12px] font-medium text-gray-400 p-4">Selecciona un año arriba para ver los meses.</p>';
    } else if (html === '') {
        html = '<p class="text-center text-[12px] font-medium text-gray-400 p-4">No hay datos en el periodo.</p>';
    }

    const dt = document.getElementById('dropdown-tree');
    if(dt) dt.innerHTML = html;
};

window.toggleTimeYear = function(y, checked) {
    if(checked) {
        if(!window.globalSelectedYears.includes(y)) {
            window.globalSelectedYears.push(y);
        }
        let seg = document.getElementById('macro-segment').value;
        let toAdd = db.remates.filter(r => {
            let matchSeg = seg === 'Todos' || r.tipo === seg;
            let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
            return matchSeg && rYr === y;
        }).map(r => r.id);

        toAdd.forEach(id => {
            if(!checkedNodes.includes(id)) checkedNodes.push(id);
        });
    } else {
        window.globalSelectedYears = window.globalSelectedYears.filter(val => val !== y);
        let toRemove = db.remates.filter(r => {
            let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
            return rYr === y;
        }).map(r => r.id);

        checkedNodes = checkedNodes.filter(id => !toRemove.includes(id));
    }
    window.actualizarEstadoApp();
};

window.toggleDropExpand = function(id) {
    if (window.expandedDropMonths.has(id)) {
        window.expandedDropMonths.delete(id);
    } else {
        window.expandedDropMonths.add(id);
    }
    window.renderDropdownUI();
};

window.toggleDropMes = function(el, year, mesIndex) {
    let isChecked = el.checked;
    let seg = document.getElementById('macro-segment').value;

    let idsInMonth = db.remates.filter(r => {
        let matchSeg = seg === 'Todos' || r.tipo === seg;
        let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
        let rM = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0;
        return matchSeg && rYr === Number(year) && rM === Number(mesIndex);
    }).map(r => r.id);

    if(isChecked) {
        idsInMonth.forEach(id => {
            if(!checkedNodes.includes(id)) checkedNodes.push(id);
        });
    } else {
        checkedNodes = checkedNodes.filter(id => !idsInMonth.includes(id));
    }

    window.actualizarEstadoApp(true);
};

window.toggleDropRemate = function(el, id) {
    if(el.checked) {
        if(!checkedNodes.includes(id)) checkedNodes.push(id);
    } else {
        checkedNodes = checkedNodes.filter(n => n !== id);
    }

    window.actualizarEstadoApp(true);
};

window.quickSelect = function(type) {
    let allowedMonths = [];
    if(type === 'TODO') allowedMonths = [0,1,2,3,4,5,6,7,8,9,10,11];
    else if(type === 'S1') allowedMonths = [0,1,2,3,4,5];
    else if(type === 'S2') allowedMonths = [6,7,8,9,10,11];
    else if(type === 'Q1') allowedMonths = [0,1,2];
    else if(type === 'Q2') allowedMonths = [3,4,5];
    else if(type === 'Q3') allowedMonths = [6,7,8];
    else if(type === 'Q4') allowedMonths = [9,10,11];

    if(type === 'NADA') {
        checkedNodes = [];
    } else {
        let seg = document.getElementById('macro-segment').value;
        checkedNodes = db.remates.filter(r => {
            let matchSeg = seg === 'Todos' || r.tipo === seg;
            let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
            let matchYr = window.globalSelectedYears.includes(rYr);
            let rM = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0;
            return matchSeg && matchYr && allowedMonths.includes(rM);
        }).map(r => r.id);
    }

    window.actualizarEstadoApp();
};

window.applyDropdown = function() {
    const menu = document.getElementById('dropdown-menu');
    if(menu) {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
};

window.updateDropdownLabel = function() {
    let labelStr = '';
    if(checkedNodes.length === 0) {
        labelStr += '0 seleccionados';
    } else if(checkedNodes.length === 1) {
        let r = db.remates.find(x => x.id === checkedNodes[0]);
        labelStr += r ? window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp).substring(0,25) : 'Matriz Única';
    } else {
        labelStr += `${checkedNodes.length} matrices`;
    }
    const lbl = document.getElementById('dropdown-label');
    if(lbl) {
        lbl.innerHTML = `📅 <span class="ml-1">${labelStr}</span>`;
    }
};

window.seleccionarUltimoRemate = function() {
    if (!db.remates || db.remates.length === 0) return;

    const rematesOrdenados = [...db.remates].sort((a,b) => (b.fechaData?.timestamp||0) - (a.fechaData?.timestamp||0));
    const ultimo = rematesOrdenados[0];

    let segSelect = document.getElementById('macro-segment');
    if (segSelect) {
        segSelect.value = ultimo.tipo || 'Siniestrados';
    }

    let y = ultimo.fechaData?.year ? Number(ultimo.fechaData.year) : new Date().getFullYear();

    window.globalSelectedYears = [y];
    checkedNodes = [ultimo.id];

    window.cambiarSeccion('remates');
    window.actualizarEstadoApp();
};

// ============================================================
// GESTOR DE MATRICES
// ============================================================
window.switchGestorYear = function(y) {
    currentGestorYearTab = y;

    const container = document.getElementById('gestor-content-container');
    const scrollPos = container ? container.scrollTop : 0;

    window.abrirModalGestor(true);

    if(container) {
        container.scrollTop = scrollPos;
    }
};

window.toggleGestorAll = function(check) {
    let seg = document.getElementById('macro-segment').value;
    let rematesEnPantalla = db.remates.filter(r => {
        let matchSeg = seg === 'Todos' || r.tipo === seg;
        let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
        return matchSeg && rYr === Number(currentGestorYearTab);
    });

    if(check) {
        let ids = rematesEnPantalla.map(r => r.id);
        ids.forEach(id => {
            if(!checkedNodes.includes(id)) checkedNodes.push(id);
        });
    } else {
        checkedNodes = [];
    }

    window.actualizarEstadoApp(true);
};

window.filtrarModalGestor = function() {
    let term = document.getElementById('search-gestor').value.toLowerCase();

    document.querySelectorAll('.gestor-mes-group').forEach(mesGroup => {
        let monthTitle = mesGroup.querySelector('span[data-search]').getAttribute('data-search').toLowerCase();
        let monthMatches = monthTitle.includes(term);
        let hasVisibleChild = false;

        mesGroup.querySelectorAll('.gestor-remate-item').forEach(remateItem => {
            let text = remateItem.querySelector('span[data-search]').getAttribute('data-search').toLowerCase();
            if(monthMatches || text.includes(term)) {
                remateItem.style.display = 'flex';
                hasVisibleChild = true;
            } else {
                remateItem.style.display = 'none';
            }
        });

        mesGroup.style.display = hasVisibleChild ? 'block' : 'none';
    });
};

window.abrirModalGestor = function(keepScroll = false) {
    const tabsContainer = document.getElementById('gestor-tabs-container');
    const contentContainer = document.getElementById('gestor-content-container');

    let currentScroll = keepScroll && contentContainer ? contentContainer.scrollTop : 0;

    let seg = document.getElementById('macro-segment').value;
    let rematesFiltrados = db.remates.filter(r => seg === 'Todos' || r.tipo === seg);

    let byYear = {};
    rematesFiltrados.forEach(r => {
        let y = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
        if(!byYear[y]) byYear[y] = {};

        let m = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0;
        if(!byYear[y][m]) byYear[y][m] = [];

        byYear[y][m].push(r);
    });

    let years = Object.keys(byYear).sort((a,b)=>b-a);
    if(years.length > 0 && !years.includes(String(currentGestorYearTab))) {
        currentGestorYearTab = years[0];
    }

    let tabsHtml = '';
    if(years.length > 1) {
        tabsHtml = `<div class="flex gap-2 p-3 overflow-x-auto bg-gray-50/50">`;
        years.forEach(y => {
            let active = String(y) === String(currentGestorYearTab) ? 'bg-[#111827] text-white shadow-md border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
            tabsHtml += `<button onclick="window.switchGestorYear('${y}')" class="px-5 py-2 rounded-full text-[13px] font-bold transition whitespace-nowrap border ${active}">Año ${y}</button>`;
        });
        tabsHtml += `</div>`;
    }
    tabsContainer.innerHTML = tabsHtml;

    let contentHtml = '';
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if(years.length === 0) {
        contentHtml = '<div class="flex items-center justify-center h-full"><p class="text-sm font-medium text-gray-400">No hay matrices disponibles.</p></div>';
    } else {
        let currentData = byYear[currentGestorYearTab] || {};
        contentHtml += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

        Object.keys(currentData).sort((a,b)=>a-b).forEach(m => {
            let rematesMes = currentData[m].sort((a,b)=> (a.fechaData?.timestamp||0) - (b.fechaData?.timestamp||0));
            let allChecked = rematesMes.every(r => checkedNodes.includes(r.id));
            let someChecked = rematesMes.some(r => checkedNodes.includes(r.id));

            contentHtml += `
            <div class="gestor-mes-group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition">
                <div class="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <label class="flex items-center gap-2 cursor-pointer w-full">
                        <span class="font-bold text-gray-900 text-[13px]" data-search="${monthNames[m]}">${monthNames[m]}</span>
                        <span class="text-gray-400 text-[10px] font-medium">(${rematesMes.length})</span>
                    </label>
                    <input type="checkbox" onchange="window.toggleGestorMes(this, ${currentGestorYearTab}, ${m})" ${allChecked ? 'checked' : ''} class="${someChecked && !allChecked ? 'opacity-50' : ''}">
                </div>
                <div class="p-3 flex flex-col gap-1 max-h-48 overflow-y-auto">
                    ${rematesMes.map(r => {
                        let isChecked = checkedNodes.includes(r.id);
                        let rName = window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp);
                        return `
                        <label class="gestor-remate-item flex items-center gap-2.5 cursor-pointer group py-1">
                            <input type="checkbox" onchange="window.toggleGestorRemate(this, '${r.id}')" ${isChecked ? 'checked' : ''} class="!w-3.5 !h-3.5">
                            <span class="text-[11px] font-medium text-gray-600 group-hover:text-black transition truncate" data-search="${rName}">${rName}</span>
                        </label>
                        `;
                    }).join('')}
                </div>
            </div>`;
        });
        contentHtml += `</div>`;
    }

    contentContainer.innerHTML = contentHtml;
    window.filtrarModalGestor();

    document.getElementById('modal-gestor').classList.remove('hidden');
    document.getElementById('modal-gestor').classList.add('flex');

    if (keepScroll && contentContainer) {
        contentContainer.scrollTop = currentScroll;
    }
};

window.cerrarModalGestor = function(e) {
    if(e && e.target.id !== 'modal-gestor') return;

    document.getElementById('modal-gestor').classList.add('hidden');
    document.getElementById('modal-gestor').classList.remove('flex');

    let searchEl = document.getElementById('search-gestor');
    if(searchEl) {
        searchEl.value = '';
    }
};

window.toggleGestorMes = function(el, year, mesIndex) {
    let isChecked = el.checked;
    let seg = document.getElementById('macro-segment').value;

    let idsInMonth = db.remates.filter(r => {
        let matchSeg = seg === 'Todos' || r.tipo === seg;
        let rYr = r.fechaData?.year ? Number(r.fechaData.year) : new Date().getFullYear();
        let rM = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0;
        return matchSeg && rYr === Number(year) && rM === Number(mesIndex);
    }).map(r => r.id);

    if(isChecked) {
        idsInMonth.forEach(id => {
            if(!checkedNodes.includes(id)) checkedNodes.push(id);
        });
    } else {
        checkedNodes = checkedNodes.filter(id => !idsInMonth.includes(id));
    }

    window.actualizarEstadoApp(true);
};

window.toggleGestorRemate = function(el, id) {
    if(el.checked) {
        if(!checkedNodes.includes(id)) checkedNodes.push(id);
    } else {
        checkedNodes = checkedNodes.filter(n => n !== id);
    }

    window.actualizarEstadoApp(true);
};

// ============================================================
// FUNCIONES DE AGREGACIÓN
// ============================================================
function buildAgg(rematesList) {
    const agg = {
        venta: 0,
        comisionTotal: 0,
        lotes: 0,
        lotesDisponibles: 0,
        inscritos: 0,
        garantias: 0,
        ganadoresUnicosCount: 0,
        nuevos: 0,
        antiguos: 0,
        ventaSiniestros: 0,
        ventaRetail: 0,
        lotesSiniestros: 0,
        lotesRetail: 0,
        ganadoresSiniestros: 0,
        ganadoresRetail: 0,
        ticketSiniestros: 0,
        ticketRetail: 0,
        ganadoresNuevos: 0,
        ventaGanadoresNuevos: 0,
        ventaGanadoresAntiguos: 0,
        adjudicaciones: [],
        sumMontoValido: 0,
        sumMinimoValido: 0,
        garantiasLista: [],
        garantiasNoAdjudicadas: []
    };

    let uniqueGanadoresSet = new Set();
    let ganadoresSiniestrosSet = new Set();
    let ganadoresRetailSet = new Set();
    let ventaSiniestros = 0;
    let ventaRetail = 0;
    let lotesSiniestros = 0;
    let lotesRetail = 0;
    let garantiasSet = new Set();

    rematesList.forEach(r => {
        try {
            agg.venta += (Number(r.ventaTotal) || 0);
            agg.comisionTotal += (Number(r.comisionTotal) || 0);
            agg.lotes += (Number(r.lotesCount) || 0);
            agg.lotesDisponibles += (Number(r.lotesDisponibles) || 0);
            agg.inscritos += (Number(r.inscritos) || 0);
            agg.garantias += (Number(r.garantias) || 0);
            agg.nuevos += (Number(r.nuevos) || 0);
            agg.antiguos += (Number(r.antiguos) || 0);
            agg.ganadoresNuevos += (Number(r.ganadoresNuevos) || 0);
            agg.ventaGanadoresNuevos += (Number(r.ventaNuevos) || 0);
            agg.ventaGanadoresAntiguos += (Number(r.ventaAntiguos) || 0);

            if (r.tipo === 'Siniestrados') {
                agg.ventaSiniestros += (Number(r.ventaTotal) || 0);
                agg.lotesSiniestros += (Number(r.lotesCount) || 0);
                ventaSiniestros += (Number(r.ventaTotal) || 0);
                lotesSiniestros += (Number(r.lotesCount) || 0);
            } else if (r.tipo === 'Retail') {
                agg.ventaRetail += (Number(r.ventaTotal) || 0);
                agg.lotesRetail += (Number(r.lotesCount) || 0);
                ventaRetail += (Number(r.ventaTotal) || 0);
                lotesRetail += (Number(r.lotesCount) || 0);
            }

            if(r.adjudicaciones && Array.isArray(r.adjudicaciones)) {
                r.adjudicaciones.forEach(a => {
                    if(!a) return;
                    let aCopy = {...a, origen: window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp), tipo: r.tipo};
                    agg.adjudicaciones.push(aCopy);

                    if(!a.esFalso && a.clienteReal) {
                        uniqueGanadoresSet.add(a.clienteReal);
                        if (r.tipo === 'Siniestrados') {
                            ganadoresSiniestrosSet.add(a.clienteReal);
                        } else if (r.tipo === 'Retail') {
                            ganadoresRetailSet.add(a.clienteReal);
                        }
                    }

                    if((Number(a.minimo) > 0) && (Number(a.monto) > 0) && !a.esFalso && !a.esChatarra) {
                        agg.sumMontoValido += Number(a.monto);
                        agg.sumMinimoValido += Number(a.minimo);
                    }
                });
            }

            if(r.garantiasListaDetallada && Array.isArray(r.garantiasListaDetallada)) {
                r.garantiasListaDetallada.forEach(g => {
                    if(!garantiasSet.has(g.nombreNorm)) {
                        garantiasSet.add(g.nombreNorm);
                        agg.garantiasLista.push(g);
                    }
                });
            }
        } catch(e) {}
    });

    // Clientes latentes = garantías - ganadores
    const ganadoresSet = new Set(uniqueGanadoresSet);
    agg.garantiasNoAdjudicadas = agg.garantiasLista.filter(g => !ganadoresSet.has(g.nombreNorm));

    agg.ganadoresUnicosCount = uniqueGanadoresSet.size;
    agg.ganadoresSiniestros = ganadoresSiniestrosSet.size;
    agg.ganadoresRetail = ganadoresRetailSet.size;
    agg.ticketSiniestros = lotesSiniestros > 0 ? ventaSiniestros / lotesSiniestros : 0;
    agg.ticketRetail = lotesRetail > 0 ? ventaRetail / lotesRetail : 0;
    agg.perdedoresCount = Math.max(0, agg.garantias - agg.ganadoresUnicosCount);
    agg.conversion = agg.garantias > 0 ? (agg.ganadoresUnicosCount / agg.garantias * 100) : 0;
    agg.tasaFuga = agg.garantias > 0 ? ((agg.garantias - agg.ganadoresUnicosCount) / agg.garantias * 100) : 0;
    agg.ticketPromedio = agg.lotes ? (agg.venta / agg.lotes) : 0;
    agg.eficaciaLotes = agg.lotesDisponibles ? (agg.lotes / agg.lotesDisponibles * 100) : 0;
    agg.pctVentaNuevos = agg.venta ? (agg.ventaGanadoresNuevos / agg.venta * 100) : 0;
    agg.deltaPujaTotal = agg.sumMontoValido - agg.sumMinimoValido;
    agg.deltaPujaPromedio = agg.lotes ? (agg.deltaPujaTotal / agg.lotes) : 0;
    agg.sobreprecioReal = agg.sumMinimoValido > 0 ? ((agg.sumMontoValido / agg.sumMinimoValido) * 100) - 100 : 0;
    agg.fugaList = agg.garantiasLista.filter(g => !uniqueGanadoresSet.has(g.nombreNorm));

    return agg;
}

// ============================================================
// NAVEGACIÓN Y RENDER DE MÓDULOS
// ============================================================
window.cambiarSeccion = function(mod) {
    try {
        currentModule = mod;
        document.getElementById('nav-mod-remates').className = mod === 'remates' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-comparativa').className = mod === 'comparativa' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-productos').className = mod === 'productos' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-clientes').className = mod === 'clientes' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-conclusiones').className = mod === 'conclusiones' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-buscador').className = mod === 'buscador' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left mt-4 bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left mt-4 hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-bonos').className = mod === 'bonos' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left mt-1 bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left mt-1 hover:bg-gray-50 text-gray-700';
        document.getElementById('nav-mod-feedback').className = mod === 'feedback' ? 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left mt-1 bg-[#111827] text-white' : 'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition text-left mt-1 hover:bg-gray-50 text-gray-700';

        window.renderApp();
        if(window.innerWidth < 768) {
            window.toggleSidebar();
        }
    } catch(e) {
        console.error(e);
    }
};

window.renderApp = function() {
    try {
        const emptyState = document.getElementById('empty-state');
        ['module-remates', 'module-comparativa', 'module-productos', 'module-clientes', 'module-conclusiones', 'module-buscador', 'module-bonos', 'module-feedback'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (checkedNodes.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
            return;
        } else {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
            const currentEl = document.getElementById(`module-${currentModule}`);
            if(currentEl) currentEl.classList.remove('hidden');
        }

        if (currentModule === 'remates') window.renderDashboard();
        else if (currentModule === 'comparativa') window.renderComparativa();
        else if (currentModule === 'productos') window.renderPanelProductos();
        else if (currentModule === 'conclusiones') window.renderConclusiones();
        else if (currentModule === 'clientes') {
            procesarDatosClientes();
            window.renderPanelClientesData(clientDB, false);
        }
        else if (currentModule === 'buscador') { window.buscarPatente(); }
        else if (currentModule === 'bonos') {
            window.calcularBonos();
        }
        else if (currentModule === 'feedback') {
            procesarFeedback();
            window.renderFeedback();
        }
    } catch(e) {
        console.error(e);
    }
};

// ============================================================
// MÓDULO: DASHBOARD DE REMATES
// ============================================================
window.renderDashboard = function() {
    try {
        if(currentModule !== 'remates') return;

        let allRemates = getSelectedRemates();
        globalAgg = buildAgg(allRemates);

        let titulo = "Selección Activa";
        try {
            if(checkedNodes.length === 1 && allRemates.length === 1) {
                titulo = window.formatearNombreRemate(allRemates[0].fileName, allRemates[0].fechaData?.timestamp);
            } else {
                titulo = "Dashboard de Remates";
            }
        } catch(e) {
            titulo = "Dashboard de Remates";
        }

        const elTitulo = document.getElementById('dash-titulo');
        if(elTitulo) elTitulo.innerText = titulo;

        const elSubtitulo = document.getElementById('dash-subtitulo');
        if(elSubtitulo) elSubtitulo.innerText = `Control operativo • ${checkedNodes.length} seleccionados`;

        try { document.getElementById('dash-kpi-ticket').innerText = formatMoney(globalAgg.ticketPromedio); } catch(e){}
        try { document.getElementById('dash-kpi-comision').innerText = formatMoney(globalAgg.comisionTotal); } catch(e){}
        try { document.getElementById('dash-kpi-venta').innerText = formatMoney(globalAgg.venta); } catch(e){}
        try { document.getElementById('dash-kpi-lotes-disp').innerText = globalAgg.lotesDisponibles.toLocaleString('es-CL'); } catch(e){}
        try { document.getElementById('dash-kpi-lotes').innerText = globalAgg.lotes.toLocaleString('es-CL'); } catch(e){}
        try { document.getElementById('dash-kpi-eficacia').innerText = `${globalAgg.eficaciaLotes.toFixed(1)}% eficacia`; } catch(e){}
        try { document.getElementById('dash-kpi-garantias').innerText = globalAgg.garantias.toLocaleString('es-CL'); } catch(e){}
        try { document.getElementById('dash-kpi-ganadores').innerText = globalAgg.ganadoresUnicosCount.toLocaleString('es-CL'); } catch(e){}
        try { document.getElementById('dash-kpi-conversion').innerText = `${globalAgg.conversion.toFixed(1)}%`; } catch(e){}
        try { document.getElementById('dash-kpi-perdedores').innerText = globalAgg.perdedoresCount.toLocaleString('es-CL'); } catch(e){}
        try { document.getElementById('dash-kpi-1racompra').innerText = globalAgg.ganadoresNuevos.toLocaleString('es-CL'); } catch(e){}
        try { document.getElementById('dash-kpi-1racompra-pct').innerText = `${globalAgg.pctVentaNuevos.toFixed(1)}%`; } catch(e){}

        try {
            document.getElementById('dash-venta-siniestros').innerText = formatMoney(globalAgg.ventaSiniestros);
            document.getElementById('dash-venta-retail').innerText = formatMoney(globalAgg.ventaRetail);
            document.getElementById('dash-lotes-siniestros').innerText = globalAgg.lotesSiniestros.toLocaleString('es-CL');
            document.getElementById('dash-lotes-retail').innerText = globalAgg.lotesRetail.toLocaleString('es-CL');
            document.getElementById('dash-ganadores-siniestros').innerText = globalAgg.ganadoresSiniestros.toLocaleString('es-CL');
            document.getElementById('dash-ganadores-retail').innerText = globalAgg.ganadoresRetail.toLocaleString('es-CL');
            document.getElementById('dash-ticket-siniestros').innerText = formatMoney(globalAgg.ticketSiniestros);
            document.getElementById('dash-ticket-retail').innerText = formatMoney(globalAgg.ticketRetail);
        } catch(e){}

        try {
            const mapC = {};
            globalAgg.adjudicaciones.forEach(a => {
                if(a.esFalso) return;
                if(!mapC[a.clienteReal]) {
                    mapC[a.clienteReal] = {lotes: 0, total: 0};
                }
                mapC[a.clienteReal].lotes++;
                mapC[a.clienteReal].total += a.monto;
            });
            let multi = 0;
            Object.values(mapC).forEach(c => {
                if(c.lotes > 1) multi++;
            });
            document.getElementById('dash-kpi-multilote').innerText = multi;
            globalMapCMulti = mapC;
        } catch(e){}

        try {
            const lotesTabla = [...globalAgg.adjudicaciones].filter(a => !a.esFalso && a.monto > 0).sort((a,b) => (parseInt(a.numeroLote)||0) - (parseInt(b.numeroLote)||0));
            if(document.getElementById('dash-tabla-lotes')) {
                document.getElementById('dash-tabla-lotes').innerHTML = lotesTabla.map(l => {
                    let deltaLote = l.minimo > 0 ? l.monto - l.minimo : 0;
                    let dSignL = deltaLote >= 0 ? '+' : '';
                    let dColorL = deltaLote > 0 ? 'text-emerald-600' : (deltaLote < 0 ? 'text-red-500' : 'text-gray-500');
                    let orId = allRemates.find(rx => window.formatearNombreRemate(rx.fileName, rx.fechaData?.timestamp) === l.origen)?.id || checkedNodes[0];
                    return `<tr class="hover:bg-gray-50 transition cursor-pointer" onclick="window.abrirModalPujadores('${encodeURIComponent(l.loteStr).replace(/'/g, "\\'")}', '${orId}')">
                        <td class="px-4 py-2 font-medium truncate max-w-[120px]" title="${l.origen}">${l.origen}</td>
                        <td class="px-3 py-2 text-center text-gray-500">Lote ${l.numeroLote||'-'}</td>
                        <td class="px-3 py-2 max-w-[280px] truncate" title="${l.loteStr}">
                            <span class="font-bold text-gray-900">${l.loteStr}</span>
                            ${l.patente && l.patente !== '-' ? `<span class="text-gray-400 text-[10px] ml-1">(${l.patente})</span>` : ''}
                            <span class="text-gray-400 block text-[10px]">👤 ${l.clienteReal}</span>
                        </td>
                        <td class="px-3 py-2 text-center"><span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold">${l.pujadoresRealesCount || 0}</span></td>
                        <td class="px-3 py-2 text-right font-medium text-gray-500">${formatMoney(l.minimo)}</td>
                        <td class="px-3 py-2 text-right font-semibold text-emerald-700">${formatMoney(l.monto)}</td>
                        <td class="px-4 py-2 text-right font-bold ${dColorL} hidden sm:table-cell">${l.minimo>0?(dSignL+formatMoney(deltaLote)):'-'}</td>
                    </tr>`;
                }).join('');
            }
        } catch(e){}

        try {
            let chartLabels = [];
            let cSiniestros = [];
            let cRetail = [];
            let cNuevos = [];
            let cRecurrentes = [];
            let cMatrices = [];
            let cLotes = [];
            let monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

            let distinctMonths = new Set(allRemates.map(r => r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0)).size;

            let forcedMode = document.getElementById('dash-groupby') ? document.getElementById('dash-groupby').value : 'auto';
            let groupMode = 'remate';
            if (forcedMode === 'auto') {
                groupMode = (distinctMonths > 1 && checkedNodes.length > 4) ? 'month' : 'remate';
            } else {
                groupMode = forcedMode;
            }

            if(groupMode === 'month') {
                let monthMap = {};
                allRemates.forEach(r => {
                    let m = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp).getMonth() : 0;
                    let y = r.fechaData?.year ? String(r.fechaData.year).slice(-2) : 'XX';
                    let labelStr = window.globalSelectedYears.length > 1 ? `${monthNamesShort[m]} '${y}` : monthNamesShort[m];

                    let mk = `${y}-${m}`;
                    if(!monthMap[mk]) {
                        monthMap[mk] = { siniestros:0, retail:0, nuevos:0, antiguos:0, lotes: 0, label: labelStr, rawD: r.fechaData?.timestamp||0, count: 0 };
                    }

                    monthMap[mk].count++;
                    monthMap[mk].lotes += (Number(r.lotesCount) || 0);
                    if(r.tipo === 'Siniestrados') monthMap[mk].siniestros += (Number(r.ventaTotal) || 0);
                    if(r.tipo === 'Retail') monthMap[mk].retail += (Number(r.ventaTotal) || 0);
                    monthMap[mk].nuevos += (Number(r.nuevos) || 0);
                    monthMap[mk].antiguos += (Number(r.antiguos) || 0);
                });

                Object.values(monthMap).sort((a,b) => a.rawD - b.rawD).forEach(v => {
                    chartLabels.push(v.label);
                    cSiniestros.push(v.siniestros);
                    cRetail.push(v.retail);
                    cNuevos.push(v.nuevos);
                    cRecurrentes.push(v.antiguos);
                    cMatrices.push(v.count);
                    cLotes.push(v.lotes);
                });
            } else {
                allRemates.sort((a,b) => (a.fechaData?.timestamp||0) - (b.fechaData?.timestamp||0)).forEach(r => {
                    chartLabels.push(window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp));
                    cSiniestros.push(r.tipo === 'Siniestrados' ? (Number(r.ventaTotal) || 0) : 0);
                    cRetail.push(r.tipo === 'Retail' ? (Number(r.ventaTotal) || 0) : 0);
                    cNuevos.push(Number(r.nuevos) || 0);
                    cRecurrentes.push(Number(r.antiguos) || 0);
                    cMatrices.push(1);
                    cLotes.push(Number(r.lotesCount) || 0);
                });
            }

            const showRetail = cRetail.some(val => val > 0);
            let datasetsVentas = [
                {
                    label: 'Venta Siniestrados',
                    data: cSiniestros,
                    type: 'line',
                    borderColor: '#111827',
                    backgroundColor: '#111827',
                    borderWidth: 2,
                    tension: 0.3,
                    pointBackgroundColor: '#111827',
                    pointRadius: 3,
                    yAxisID: 'y'
                }
            ];

            if(showRetail) {
                datasetsVentas.push({
                    label: 'Venta Retail',
                    data: cRetail,
                    type: 'line',
                    borderColor: '#9CA3AF',
                    backgroundColor: '#9CA3AF',
                    borderWidth: 2,
                    tension: 0.3,
                    pointBackgroundColor: '#9CA3AF',
                    pointRadius: 3,
                    yAxisID: 'y'
                });
            }

            datasetsVentas.push({
                label: 'Lotes Vendidos',
                data: cLotes,
                type: 'bar',
                backgroundColor: '#E5E7EB',
                borderRadius: 4,
                yAxisID: 'y1'
            });

            const canvasVentas = document.getElementById('dash-chartVentas');
            if(canvasVentas) {
                if(dashChartVentasInst) dashChartVentasInst.destroy();
                dashChartVentasInst = new Chart(canvasVentas.getContext('2d'), {
                    type: 'line',
                    data: { labels: chartLabels, datasets: datasetsVentas },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    afterBody: function(context) {
                                        return '\nMatrices: ' + cMatrices[context[0].dataIndex];
                                    }
                                }
                            },
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: { boxWidth: 10, usePointStyle: true }
                            }
                        },
                        scales: {
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                beginAtZero: true,
                                grid: { color: '#F3F4F6' }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                grid: { drawOnChartArea: false },
                                beginAtZero: true
                            }
                        }
                    }
                });
            }

            const canvasClientes = document.getElementById('dash-chartClientes');
            if (canvasClientes) {
                if(dashChartClientesInst) dashChartClientesInst.destroy();
                dashChartClientesInst = new Chart(canvasClientes.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: chartLabels,
                        datasets: [
                            {
                                label: 'Recurrentes',
                                data: cRecurrentes,
                                backgroundColor: '#111827',
                                borderRadius: 4
                            },
                            {
                                label: 'Nuevos',
                                data: cNuevos,
                                backgroundColor: '#D1D5DB',
                                borderRadius: 4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: true, position: 'bottom', labels: { boxWidth: 10 } }
                        },
                        scales: {
                            x: { stacked: true, grid: { display: false } },
                            y: { stacked: true, grid: { color: '#F3F4F6' } }
                        }
                    }
                });
            }
        } catch(e) {
            console.error("Error graficos", e);
        }

    } catch(e) {
        console.error(e);
    }
};

// ============================================================
// MÓDULO: COMPARATIVA HISTÓRICA
// ============================================================
window.renderComparativa = function() {
    try {
        if(currentModule !== 'comparativa') return;

        let allRemates = getSelectedRemates();
        let groupMode = document.getElementById('comp-groupby').value;
        let groups = {};
        let monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        allRemates.forEach(r => {
            let d = r.fechaData;
            let dateObj = d?.timestamp ? new Date(d.timestamp) : new Date();
            let y = d?.year || dateObj.getFullYear();
            let m = dateObj.getMonth();

            let key = '';
            let label = '';

            if(groupMode === 'remate') {
                key = `R-${d?.timestamp || 0}-${r.id}`;
                label = window.formatearNombreRemate(r.fileName, d?.timestamp);
            } else if(groupMode === 'year') {
                key = `${y}`;
                label = `Año ${y}`;
            } else if(groupMode === 'semester') {
                let s = m < 6 ? 1 : 2;
                key = `${y}-S${s}`;
                label = `S${s} ${y}`;
            } else if(groupMode === 'quarter') {
                let q = Math.floor(m/3) + 1;
                key = `${y}-Q${q}`;
                label = `Q${q} ${y}`;
            } else {
                key = `${y}-${String(m).padStart(2,'0')}`;
                label = `${monthNamesShort[m]} ${y}`;
            }

            if(!groups[key]) {
                groups[key] = { label, key, remates: [], timestamp: d?.timestamp || 0 };
            }
            groups[key].remates.push(r);
        });

        let sortedKeys;
        if(groupMode === 'remate') {
            sortedKeys = Object.keys(groups).sort((a,b) => groups[a].timestamp - groups[b].timestamp);
        } else {
            sortedKeys = Object.keys(groups).sort();
        }

        let tableHtml = '';
        let chartLabels = [];
        let dataVenta = [];
        let dataComision = [];
        let dataLotes = [];
        let dataMatrices = [];

        sortedKeys.forEach(k => {
            let g = groups[k];
            let agg = buildAgg(g.remates);
            chartLabels.push(g.label);
            dataVenta.push(agg.venta);
            dataComision.push(agg.comisionTotal);
            dataLotes.push(agg.lotes);
            dataMatrices.push(g.remates.length);

            tableHtml += `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                <td class="pl-4 py-3 font-medium text-gray-900">${g.label}</td>
                <td class="text-center py-3 text-gray-500">${g.remates.length}</td>
                <td class="text-center py-3 text-gray-900">${agg.lotes.toLocaleString('es-CL')}</td>
                <td class="text-center py-3 font-semibold text-emerald-600">${agg.eficaciaLotes.toFixed(1)}%</td>
                <td class="text-right py-3 font-bold text-gray-900">${formatMoney(agg.venta)}</td>
                <td class="text-right pr-4 py-3 font-medium text-gray-500">${formatMoney(agg.comisionTotal)}</td>
            </tr>`;
        });

        document.getElementById('comp-table-body').innerHTML = tableHtml;

        const canvasComp = document.getElementById('comp-chart');
        if(canvasComp) {
            if(compChartInst) compChartInst.destroy();
            compChartInst = new Chart(canvasComp.getContext('2d'), {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [
                        { label: 'Venta Total Adjudicada', data: dataVenta, type: 'line', borderColor: '#111827', backgroundColor: '#111827', borderWidth: 2, tension: 0.3, pointBackgroundColor: '#111827', pointRadius: 3, yAxisID: 'y' },
                        { label: 'Comisiones Estimadas', data: dataComision, type: 'line', borderColor: '#9CA3AF', backgroundColor: '#9CA3AF', borderWidth: 1.5, borderDash: [5, 5], tension: 0.3, pointBackgroundColor: '#9CA3AF', pointRadius: 2, yAxisID: 'y' },
                        { label: 'Lotes Vendidos', data: dataLotes, type: 'bar', backgroundColor: '#E5E7EB', borderRadius: 4, yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                afterBody: function(context) {
                                    return '\nMatrices: ' + dataMatrices[context[0].dataIndex];
                                }
                            }
                        },
                        legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }
                    },
                    scales: {
                        y: { type: 'linear', display: true, position: 'left', beginAtZero: true, grid: { color: '#F3F4F6'} },
                        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true }
                    }
                }
            });
        }
    } catch(e) {
        console.error(e);
    }
};

// ============================================================
// MÓDULO: ANÁLISIS DE PRODUCTOS (ex-Análisis Vehicular)
// ============================================================
window.switchProductosTab = function(tab) {
    currentProductosTab = tab;
    document.getElementById('tab-siniestrados').className = tab === 'siniestrados' ? 'px-4 py-2 rounded-t-lg text-[13px] font-medium transition tab-active' : 'px-4 py-2 rounded-t-lg text-[13px] font-medium transition tab-inactive';
    document.getElementById('tab-retail').className = tab === 'retail' ? 'px-4 py-2 rounded-t-lg text-[13px] font-medium transition tab-active' : 'px-4 py-2 rounded-t-lg text-[13px] font-medium transition tab-inactive';
    document.getElementById('productos-siniestrados').style.display = tab === 'siniestrados' ? 'block' : 'none';
    document.getElementById('productos-retail').style.display = tab === 'retail' ? 'block' : 'none';
    window.renderPanelProductos();
};

window.renderPanelProductos = function() {
    try {
        if(currentModule !== 'productos') return;

        const term = (document.getElementById('search-productos')?.value || '').toLowerCase().trim();
        const allRemates = getSelectedRemates();

        // ====== SINIESTRADOS ======
        let autosSiniestrados = [];
        let allSiniestrados = allRemates.filter(r => r.tipo === 'Siniestrados');
        allSiniestrados.forEach(r => {
            r.adjudicaciones.forEach(a => {
                if(!a.esFalso && !a.esChatarra) {
                    autosSiniestrados.push({
                        ...a,
                        remate: window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp)
                    });
                }
            });
        });

        if (term) {
            autosSiniestrados = autosSiniestrados.filter(a =>
                (a.loteStr || '').toLowerCase().includes(term) ||
                (a.categoria || '').toLowerCase().includes(term) ||
                (a.numeroLote || '').toString().includes(term) ||
                (a.modeloStr || '').toLowerCase().includes(term) ||
                (a.patente || '').toLowerCase().includes(term)
            );
        }

        let marcasMap = {};
        let modelosMap = {};
        autosSiniestrados.forEach(a => {
            if(a.categoria && a.categoria !== 'OTROS' && a.categoria !== 'SIN MARCA') {
                marcasMap[a.categoria] = (marcasMap[a.categoria] || 0) + 1;
            }
            if(a.modeloStr && a.modeloStr.trim() !== '') {
                modelosMap[a.modeloStr] = (modelosMap[a.modeloStr] || 0) + 1;
            }
        });

        const marcasSorted = Object.entries(marcasMap).sort((a,b) => b[1] - a[1]).slice(0,5);
        try {
            if(flotaMarcasInst) flotaMarcasInst.destroy();
            if(marcasSorted.length > 0 && document.getElementById('flota-marcas-chart')) {
                flotaMarcasInst = new Chart(document.getElementById('flota-marcas-chart').getContext('2d'), {
                    type:'doughnut',
                    data:{
                        labels: marcasSorted.map(m => m[0]),
                        datasets:[{
                            data: marcasSorted.map(m => m[1]),
                            backgroundColor: ['#111827','#374151','#6B7280','#9CA3AF','#D1D5DB'],
                            borderWidth: 0
                        }]
                    },
                    options:{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout:'75%',
                        plugins:{
                            legend:{ position:'right', labels: {boxWidth: 10} }
                        }
                    }
                });
            }

            const modelosSorted = Object.entries(modelosMap).sort((a,b) => b[1] - a[1]).slice(0,7);
            if(flotaAniosInst) flotaAniosInst.destroy();
            if(modelosSorted.length > 0 && document.getElementById('flota-modelos-chart')) {
                flotaAniosInst = new Chart(document.getElementById('flota-modelos-chart').getContext('2d'), {
                    type:'bar',
                    data:{
                        labels: modelosSorted.map(a => a[0]),
                        datasets:[{
                            label: 'Unidades',
                            data: modelosSorted.map(a => a[1]),
                            backgroundColor: '#111827',
                            borderRadius: 4
                        }]
                    },
                    options:{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: {grid:{color:'#F3F4F6'}},
                            y: {grid:{display:false}}
                        }
                    }
                });
            }
        } catch(ec) {}

        if(document.getElementById('productos-tabla-siniestrados')) {
            document.getElementById('productos-tabla-siniestrados').innerHTML = autosSiniestrados.map(a => {
                return `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-2 font-medium text-gray-500 max-w-[150px] truncate" title="${a.remate}">${a.remate}</td>
                    <td class="px-3 py-2 text-center text-gray-800">Lote ${a.numeroLote||'-'}</td>
                    <td class="px-3 py-2 max-w-[200px] truncate">
                        <span class="font-bold text-gray-900">${a.categoria}</span>
                        <span class="text-gray-500 font-medium">${a.modeloStr}</span>
                        ${a.patente && a.patente!=='-' ? `<span class="text-[10px] text-gray-400 ml-1">(${a.patente})</span>` : ''}
                    </td>
                    <td class="px-3 py-2 text-right text-gray-500 font-medium">${formatMoney(a.minimo)}</td>
                    <td class="px-4 py-2 text-right font-bold text-emerald-700">${formatMoney(a.monto)}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="5" class="p-8 text-center text-gray-400 font-medium">Sin vehículos en la selección actual.</td></tr>';
        }

        // ====== RETAIL ======
        let productosRetail = [];
        let allRetail = allRemates.filter(r => r.tipo === 'Retail');
        allRetail.forEach(r => {
            r.adjudicaciones.forEach(a => {
                if(!a.esFalso && !a.esChatarra) {
                    const categoria = a.categoria || 'OTROS';
                    const subcategoria = a.modeloStr || a.loteStr?.substring(0,30) || 'Sin descripción';
                    productosRetail.push({
                        ...a,
                        remate: window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp),
                        categoria: categoria,
                        subcategoria: subcategoria
                    });
                }
            });
        });

        if (term) {
            productosRetail = productosRetail.filter(a =>
                (a.loteStr || '').toLowerCase().includes(term) ||
                (a.categoria || '').toLowerCase().includes(term) ||
                (a.subcategoria || '').toLowerCase().includes(term) ||
                (a.numeroLote || '').toString().includes(term)
            );
        }

        let categoriasMap = {};
        let subcategoriasMap = {};
        productosRetail.forEach(a => {
            categoriasMap[a.categoria] = (categoriasMap[a.categoria] || 0) + 1;
            if (a.subcategoria && a.subcategoria !== 'Sin descripción') {
                subcategoriasMap[a.subcategoria] = (subcategoriasMap[a.subcategoria] || 0) + 1;
            }
        });

        const categoriasSorted = Object.entries(categoriasMap).sort((a,b) => b[1] - a[1]).slice(0,5);
        try {
            if(retailCategoriasInst) retailCategoriasInst.destroy();
            if(categoriasSorted.length > 0 && document.getElementById('retail-categorias-chart')) {
                retailCategoriasInst = new Chart(document.getElementById('retail-categorias-chart').getContext('2d'), {
                    type:'doughnut',
                    data:{
                        labels: categoriasSorted.map(m => m[0]),
                        datasets:[{
                            data: categoriasSorted.map(m => m[1]),
                            backgroundColor: ['#111827','#374151','#6B7280','#9CA3AF','#D1D5DB','#E5E7EB'],
                            borderWidth: 0
                        }]
                    },
                    options:{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout:'75%',
                        plugins:{
                            legend:{ position:'right', labels: {boxWidth: 10} }
                        }
                    }
                });
            }

            const subcategoriasSorted = Object.entries(subcategoriasMap).sort((a,b) => b[1] - a[1]).slice(0,7);
            if(retailSubcategoriasInst) retailSubcategoriasInst.destroy();
            if(subcategoriasSorted.length > 0 && document.getElementById('retail-subcategorias-chart')) {
                retailSubcategoriasInst = new Chart(document.getElementById('retail-subcategorias-chart').getContext('2d'), {
                    type:'bar',
                    data:{
                        labels: subcategoriasSorted.map(a => a[0]),
                        datasets:[{
                            label: 'Unidades',
                            data: subcategoriasSorted.map(a => a[1]),
                            backgroundColor: '#111827',
                            borderRadius: 4
                        }]
                    },
                    options:{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: {grid:{color:'#F3F4F6'}},
                            y: {grid:{display:false}}
                        }
                    }
                });
            }
        } catch(ec) {}

        if(document.getElementById('productos-tabla-retail')) {
            document.getElementById('productos-tabla-retail').innerHTML = productosRetail.map(a => {
                return `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-2 font-medium text-gray-500 max-w-[150px] truncate" title="${a.remate}">${a.remate}</td>
                    <td class="px-3 py-2 text-center text-gray-800">Lote ${a.numeroLote||'-'}</td>
                    <td class="px-3 py-2 max-w-[200px] truncate">
                        <span class="font-bold text-gray-900">${a.categoria}</span>
                        <span class="text-gray-500 text-[11px]">${a.subcategoria}</span>
                    </td>
                    <td class="px-3 py-2 text-right text-gray-500 font-medium">${formatMoney(a.minimo)}</td>
                    <td class="px-4 py-2 text-right font-bold text-emerald-700">${formatMoney(a.monto)}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="5" class="p-8 text-center text-gray-400 font-medium">Sin productos Retail en la selección actual.</td></tr>';
        }

    } catch(e) { console.error(e); }
};

// ============================================================
// MÓDULO: GESTIÓN DE CLIENTES
// ============================================================
function procesarDatosClientes() {
    try {
        let allRemates = getSelectedRemates();
        if(!allRemates.length) {
            clientDB = [];
            clientesLatentes = [];
            return;
        }

        const mapBI = {};
        const MAX_TIMESTAMP = Math.max(...allRemates.map(r => r.fechaData?.timestamp || 0));

        allRemates.forEach(r => {
            r.adjudicaciones.forEach(adj => {
                if(adj.esFalso) return;
                const c = adj.clienteReal;
                if(!mapBI[c]) {
                    mapBI[c] = {
                        nombre: c,
                        rut: adj.rut || '-',
                        email: adj.email || '-',
                        compras: [],
                        totalGastado: 0,
                        lotesSiniestrados: 0,
                        lotesRetail: 0,
                        tipos: new Set()
                    };
                }
                mapBI[c].compras.push({
                    fecha: r.fechaData?.timestamp,
                    monto: adj.monto,
                    tipo: r.tipo,
                    lote: adj.numeroLote ? 'Lote ' + adj.numeroLote : (adj.loteStr ? adj.loteStr.substring(0,10) : ''),
                    remate: window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp)
                });
                mapBI[c].totalGastado += (Number(adj.monto) || 0);
                if(r.tipo === 'Siniestrados') {
                    mapBI[c].lotesSiniestrados++;
                } else {
                    mapBI[c].lotesRetail++;
                }
                mapBI[c].tipos.add(r.tipo);
            });
        });

        clientDB = Object.values(mapBI).map(c => {
            c.compras.sort((a,b) => b.fecha - a.fecha);
            c.primeraCompra = c.compras.length > 0 ? c.compras[c.compras.length-1].fecha : null;
            c.ultimaCompra = c.compras.length > 0 ? c.compras[0].fecha : null;
            c.frecuencia = c.compras.length;
            c.recencyDias = c.ultimaCompra ? Math.floor((MAX_TIMESTAMP - c.ultimaCompra) / (1000*60*60*24)) : 0;
            c.isHybrid = c.tipos.size > 1;

            if(c.frecuencia > 3 && c.recencyDias <= 60) {
                c.segmento = "Frecuente";
                c.bg = "badge-frecuente";
            } else if(c.frecuencia > 1 && c.recencyDias <= 60) {
                c.segmento = "Recurrente";
                c.bg = "badge-recurrente";
            } else if(c.frecuencia === 1 && c.recencyDias <= 60) {
                c.segmento = "Nuevo";
                c.bg = "badge-nuevo";
            } else {
                c.segmento = "En Riesgo";
                c.bg = "badge-riesgo";
            }
            if(c.isHybrid) c.bg = "badge-hybrid";
            return c;
        }).sort((a,b) => b.totalGastado - a.totalGastado);

        // Clientes latentes = garantías no adjudicadas
        const agg = buildAgg(allRemates);
        clientesLatentes = agg.garantiasNoAdjudicadas || [];

    } catch(e) { console.error(e); }
}

window.renderPanelClientesData = function(filtered, isFiltered = false) {
    try {
        const total = clientDB.length;
        const hybrid = clientDB.filter(c => c.isHybrid).length;
        const hybridPct = total > 0 ? (hybrid / total * 100) : 0;
        const latentes = clientesLatentes.length;

        document.getElementById('bi-kpi-total').innerText = total;
        document.getElementById('bi-kpi-ltv').innerText = formatMoney(total ? clientDB.reduce((a,b) => a + b.totalGastado, 0) / total : 0);
        document.getElementById('bi-kpi-hybrid').innerText = hybrid;
        document.getElementById('bi-kpi-hybrid-pct').innerText = hybridPct.toFixed(1) + '% del total';
        document.getElementById('bi-kpi-latentes').innerText = latentes;

        // Tabla de clientes
        if(document.getElementById('bi-tabla-clientes')) {
            document.getElementById('bi-tabla-clientes').innerHTML = filtered.map(c => `
                <tr onclick="window.abrirFichaCliente('${c.nombre.replace(/'/g,"\\'")}')" class="cursor-pointer hover:bg-gray-50 transition">
                    <td class="px-4 py-2 font-medium text-gray-900 max-w-[150px] truncate">
                        ${c.nombre}
                        ${c.isHybrid ? '<span class="text-[9px] font-bold text-purple-600 ml-1">🔄</span>' : ''}
                    </td>
                    <td class="px-3 py-2 text-center text-gray-500">${c.frecuencia}</td>
                    <td class="px-3 py-2 text-right font-semibold text-emerald-600">${formatMoney(c.totalGastado)}</td>
                    <td class="px-4 py-2 text-center hidden sm:table-cell"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg}">${c.segmento}</span></td>
                </tr>
            `).join('');
        }

        // Tabla de clientes latentes
        if(document.getElementById('bi-tabla-latentes')) {
            const latentesOrdenados = [...clientesLatentes].sort((a,b) => (b.fechaRemate || 0) - (a.fechaRemate || 0)).slice(0,50);
            document.getElementById('bi-tabla-latentes').innerHTML = latentesOrdenados.map(l => `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-2 font-medium text-gray-900 truncate max-w-[150px]">${l.nombre || 'Sin nombre'}</td>
                    <td class="px-3 py-2 text-gray-500">${l.rut || '-'}</td>
                    <td class="px-3 py-2 hidden sm:table-cell text-gray-500 truncate max-w-[150px]">${l.email || '-'}</td>
                    <td class="px-3 py-2 text-center text-gray-500">${l.fechaRemate ? window.formatExcelDate(l.fechaRemate) : '-'}</td>
                    <td class="px-3 py-2 text-right font-semibold text-gray-700">${formatMoney(l.montoGarantia || 0)}</td>
                    <td class="px-4 py-2 text-center text-gray-400">${l.intentos || 1}</td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="p-8 text-center text-gray-400 font-medium">No hay clientes latentes en la selección actual.</td></tr>';
        }

        if(!isFiltered) {
            const segCount = {};
            clientDB.forEach(c => {
                segCount[c.segmento] = (segCount[c.segmento] || 0) + 1;
            });
            if(biChartSegmentsInst) biChartSegmentsInst.destroy();
            if(Object.keys(segCount).length > 0 && document.getElementById('bi-chartSegments')) {
                biChartSegmentsInst = new Chart(document.getElementById('bi-chartSegments').getContext('2d'), {
                    type:'doughnut',
                    data:{
                        labels: Object.keys(segCount),
                        datasets:[{
                            data: Object.values(segCount),
                            backgroundColor: ['#111827','#3b82f6','#10b981','#ef4444','#8b5cf6'],
                            borderWidth: 0
                        }]
                    },
                    options:{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '75%',
                        plugins:{
                            legend:{ position:'right', labels:{boxWidth:10} }
                        }
                    }
                });
            }
        }
    } catch(e) { console.error(e); }
};

window.filtrarClientes = function() {
    try {
        const term = (document.getElementById('search-client').value || '').toLowerCase();
        const tipo = document.getElementById('filter-client-type').value;

        let filtered = clientDB.filter(c => {
            const matchName = (c.nombre || '').toLowerCase().includes(term);
            let matchTipo = true;
            if(tipo === 'siniestrados') matchTipo = c.lotesSiniestrados > 0 && c.lotesRetail === 0;
            if(tipo === 'retail') matchTipo = c.lotesRetail > 0 && c.lotesSiniestrados === 0;
            if(tipo === 'ambos') matchTipo = c.isHybrid;
            return matchName && matchTipo;
        });
        window.renderPanelClientesData(filtered, term !== "" || tipo !== "todos");
    } catch(e) { console.error(e); }
};

window.abrirFichaCliente = function(nombreStr) {
    try {
        const c = clientDB.find(x => x.nombre === nombreStr);
        if(!c) return;

        const ficha = document.getElementById('bi-ficha-cliente');
        if(ficha) ficha.classList.remove('hidden');

        document.getElementById('ficha-nombre').innerText = c.nombre;
        document.getElementById('ficha-rut').innerText = c.rut;
        document.getElementById('ficha-email').innerText = c.email;
        document.getElementById('ficha-primera').innerText = c.primeraCompra ? window.formatExcelDate(c.primeraCompra) : '-';
        document.getElementById('ficha-ultima').innerText = `Hace ${c.recencyDias} d`;
        document.getElementById('ficha-lotes').innerText = c.frecuencia;
        document.getElementById('ficha-monto-sin').innerText = formatMoney(c.compras.filter(x => x.tipo === 'Siniestrados').reduce((a,b) => a + (Number(b.monto) || 0), 0));
        document.getElementById('ficha-monto-ret').innerText = formatMoney(c.compras.filter(x => x.tipo === 'Retail').reduce((a,b) => a + (Number(b.monto) || 0), 0));

        document.getElementById('ficha-historial-tabla').innerHTML = c.compras.map(h => `
            <tr class="hover:bg-white/5">
                <td class="py-2 px-3 text-[11px] text-gray-400">${h.fecha ? window.formatExcelDate(h.fecha) : '-'}</td>
                <td class="py-2 px-3 text-[11px] text-white truncate max-w-[120px]">${h.remate ? h.remate : '-'}</td>
                <td class="py-2 px-3 text-[11px] text-gray-400">${h.tipo}</td>
                <td class="py-2 px-3 text-[11px] font-bold text-blue-400">${h.lote}</td>
                <td class="py-2 px-3 text-right text-[11px] font-bold text-emerald-400">${formatMoney(h.monto)}</td>
            </tr>
        `).join('');

        if(ficha) ficha.scrollIntoView({behavior:'smooth'});
    } catch(e) { console.error(e); }
};

window.cerrarFicha = function() {
    const ficha = document.getElementById('bi-ficha-cliente');
    if(ficha) ficha.classList.add('hidden');
};

window.exportarLatentesExcel = function() {
    try {
        if(!clientesLatentes || clientesLatentes.length === 0) {
            alert('No hay clientes latentes para exportar.');
            return;
        }
        const wsData = clientesLatentes.map(l => ({
            "Cliente": l.nombre || 'Sin nombre',
            "RUT": l.rut || '-',
            "Email": l.email || '-',
            "Fecha Última Garantía": l.fechaRemate ? window.formatExcelDate(l.fechaRemate) : '-',
            "Monto Garantía": l.montoGarantia || 0,
            "Intentos": l.intentos || 1,
            "Segmento": "Latente"
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes_Latentes");
        XLSX.writeFile(wb, `Clientes_Latentes_${new Date().getTime()}.xlsx`);
    } catch(e) { console.error(e); }
};

// ============================================================
// MÓDULO: CONCLUSIONES
// ============================================================
window.renderConclusiones = function() {
    try {
        if(currentModule !== 'conclusiones') return;
        let allRemates = getSelectedRemates();
        const agg = buildAgg(allRemates);
        let html = '';
        globalAgg = agg;

        if(!clientDB.length) {
            procesarDatosClientes();
        }

        let sobreSigno = agg.sobreprecioReal >= 0 ? '+' : '';
        let sobreColor = agg.sobreprecioReal >= 0 ? 'text-emerald-600' : 'text-red-500';
        let tasaExito = agg.garantias ? (agg.ganadoresUnicosCount / agg.garantias * 100) : 0;
        let falsos = agg.adjudicaciones.filter(a => a.esFalso).length;

        html += `
        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div class="text-[13px] font-black mb-1">Resultados Financieros</div>
            <div class="text-[12px] text-gray-500 mb-3">Análisis de rentabilidad y comisiones por periodo seleccionado</div>
            <table class="w-full text-[12px]">
                <tbody class="divide-y divide-gray-100">
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Venta Total Adjudicada</td><td class="py-2.5 font-bold text-lg">${formatMoney(agg.venta)}</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Suma operaciones válidas</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Comisiones Estimadas</td><td class="py-2.5 font-bold text-blue-600">${formatMoney(agg.comisionTotal)}</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Ingresos al 8/12%</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Ticket Promedio</td><td class="py-2.5 font-bold">${formatMoney(agg.ticketPromedio)}</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">${agg.lotes} ops</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Tasa de Conversión</td><td class="py-2.5 font-bold text-purple-600">${tasaExito.toFixed(1)}%</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Garantías → Ganadores</td></tr>
                </tbody>
            </table>
        </div>`;

        html += `
        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div class="text-[13px] font-black mb-1">Rendimiento de Catálogo</div>
            <div class="text-[12px] text-gray-500 mb-3">Efectividad y rotación por matriz</div>
            <table class="w-full text-[12px]">
                <tbody class="divide-y divide-gray-100">
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Efectividad Total</td><td class="py-2.5 font-bold text-emerald-600 text-lg">${agg.eficaciaLotes.toFixed(1)}%</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Subastado exitosamente</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Volumen Físico</td><td class="py-2.5 font-bold">${agg.lotes.toLocaleString('es-CL')} <span class="font-normal text-gray-400 text-[10px]">de ${agg.lotesDisponibles.toLocaleString('es-CL')} disp.</span></td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Unidades procesadas</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Incremento sobre Mínimo</td><td class="py-2.5 font-bold">${sobreSigno}${formatMoney(agg.deltaPujaTotal)} <span class="${sobreColor} font-bold text-[10px] ml-1">(${sobreSigno}${agg.sobreprecioReal.toFixed(1)}%)</span></td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Margen pujas</td></tr>
                </tbody>
            </table>
        </div>`;

        html += `
        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div class="text-[13px] font-black mb-1">Tracción y Audiencia</div>
            <div class="text-[12px] text-gray-500 mb-3">Comportamiento de audiencia y adquisición de clientes</div>
            <table class="w-full text-[12px]">
                <tbody class="divide-y divide-gray-100">
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Tasa de Cierre</td><td class="py-2.5 font-bold text-emerald-600 text-lg">${tasaExito.toFixed(1)}%</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">De ${agg.garantias.toLocaleString('es-CL')} garantías</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Clientes Latentes</td><td class="py-2.5 font-bold text-amber-600">${agg.garantiasNoAdjudicadas.length.toLocaleString('es-CL')}</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Pagaron garantía sin comprar</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Clientes Nuevos</td><td class="py-2.5 font-bold">${agg.ganadoresNuevos.toLocaleString('es-CL')} <span class="font-normal text-gray-400 text-[10px]">(${agg.pctVentaNuevos.toFixed(1)}% vta)</span></td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Adquisición pura</td></tr>
                    <tr><td class="py-2.5 font-medium w-1/3 text-gray-700">Limpieza Datos (Falsos)</td><td class="py-2.5 font-bold text-gray-400">${falsos}</td><td class="py-2.5 text-gray-500 hidden sm:table-cell">Pujas internas de prueba</td></tr>
                </tbody>
            </table>
            <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">🛡️ Siniestrados</span>
                    <div class="mt-1 text-[13px] font-bold text-emerald-600">${formatMoney(agg.ventaSiniestros)}</div>
                    <div class="text-[11px] text-gray-500">${agg.lotesSiniestros} lotes • ${agg.ganadoresSiniestros} ganadores</div>
                </div>
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">🛒 Retail</span>
                    <div class="mt-1 text-[13px] font-bold text-emerald-600">${formatMoney(agg.ventaRetail)}</div>
                    <div class="text-[11px] text-gray-500">${agg.lotesRetail} lotes • ${agg.ganadoresRetail} ganadores</div>
                </div>
            </div>
        </div>`;

        document.getElementById('conclusiones-content').innerHTML = html;
    } catch(e) { console.error(e); }
};

// ============================================================
// MÓDULO: BUSCADOR GLOBAL
// ============================================================
window.buscarPatente = function() {
    try {
        const term = (document.getElementById('search-patente').value || '').toUpperCase().trim();
        const tbody = document.getElementById('buscador-tabla-resultados');
        if(term.length < 3) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 font-medium">Usa la barra superior para buscar en toda la base de datos sincronizada.</td></tr>';
            return;
        }
        let resultados = [];
        db.remates.forEach(r => {
            r.adjudicaciones.forEach(adj => {
                if((adj.loteStr || '').includes(term) ||
                   (adj.clienteReal || '').includes(term) ||
                   (adj.numeroLote || '').toString().includes(term) ||
                   (adj.rut || '').includes(term) ||
                   (adj.email || '').toUpperCase().includes(term) ||
                   (adj.patente || '').toUpperCase().includes(term)) {
                    resultados.push({
                        fecha: r.fechaData?.timestamp,
                        remate: window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp),
                        lote: adj.loteStr,
                        numeroLote: adj.numeroLote,
                        monto: adj.monto,
                        cliente: adj.clienteReal,
                        patente: adj.patente
                    });
                }
            });
        });
        resultados.sort((a,b) => b.fecha - a.fecha);
        if(!resultados.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center font-bold text-red-500">Sin resultados para la búsqueda "${term}"</td></tr>`;
            return;
        }
        tbody.innerHTML = resultados.map(res => `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-2 text-gray-500 font-medium">${res.fecha ? window.formatExcelDate(res.fecha) : '-'}</td>
                <td class="px-3 py-2 font-medium text-gray-900 truncate max-w-[150px]">${res.remate ? res.remate : '-'}</td>
                <td class="px-3 py-2 text-center text-gray-500">Lote ${res.numeroLote||'-'}</td>
                <td class="px-3 py-2 max-w-[200px] truncate hidden sm:table-cell text-gray-700">
                    ${res.lote} ${res.patente && res.patente !== '-' ? `<span class="text-[10px] text-gray-400 ml-1">(${res.patente})</span>` : ''}
                </td>
                <td class="px-3 py-2 font-bold text-gray-900 truncate max-w-[150px]">${res.cliente}</td>
                <td class="px-4 py-2 text-right font-black text-emerald-600">${formatMoney(res.monto)}</td>
            </tr>
        `).join('');
    } catch(e) { console.error(e); }
};

// ============================================================
// MÓDULO: BONOS DE GESTIÓN
// ============================================================
window.calcularBonos = function() {
    const allRemates = getSelectedRemates();
    if (!allRemates || allRemates.length < 2) {
        document.getElementById('bono-total-mes').innerText = '$0';
        document.getElementById('bono-kpis-cumplidos').innerText = '0/4';
        document.getElementById('bono-nuevos-clientes').innerText = '0';
        document.getElementById('bono-crecimiento-ventas').innerText = '0%';
        document.getElementById('bono-mes-label').innerText = 'Sin datos suficientes';
        document.getElementById('bono-kpis-detalle').innerHTML = `
            <div class="col-span-full text-center text-gray-400 py-8">
                <p class="text-sm font-medium">Se necesitan al menos 2 meses de datos para calcular bonos</p>
            </div>
        `;
        document.getElementById('bono-historial-tabla').innerHTML = `
            <tr><td colspan="7" class="p-8 text-center text-gray-400">Sin datos históricos</td></tr>
        `;
        return;
    }

    const meses = agruparPorMes(allRemates);
    const mesesKeys = Object.keys(meses).sort();

    if (mesesKeys.length < 2) {
        document.getElementById('bono-total-mes').innerText = '$0';
        document.getElementById('bono-kpis-cumplidos').innerText = '0/4';
        document.getElementById('bono-nuevos-clientes').innerText = '0';
        document.getElementById('bono-crecimiento-ventas').innerText = '0%';
        document.getElementById('bono-mes-label').innerText = 'Se necesita más de 1 mes';
        return;
    }

    const clientesInfo = identificarClientes(allRemates);
    const resultadosMensuales = calcularKPIsMensuales(meses, clientesInfo, mesesKeys);
    historialBonos = resultadosMensuales;
    const ultimoMes = resultadosMensuales[resultadosMensuales.length - 1];
    bonoActual = ultimoMes;
    renderizarBonoActual(ultimoMes);
    renderizarHistorialBonos(resultadosMensuales);
};

function agruparPorMes(remates) {
    const meses = {};
    remates.forEach(r => {
        const fecha = r.fechaData?.timestamp ? new Date(r.fechaData.timestamp) : new Date();
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const label = `${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
        if (!meses[key]) {
            meses[key] = { key, label, remates: [], fecha: fecha.getTime(), ventaTotal: 0 };
        }
        meses[key].remates.push(r);
        meses[key].ventaTotal += (Number(r.ventaTotal) || 0);
    });
    return meses;
}

function identificarClientes(remates) {
    const clientesMap = {};
    const sortedRemates = [...remates].sort((a, b) => (a.fechaData?.timestamp || 0) - (b.fechaData?.timestamp || 0));
    sortedRemates.forEach(r => {
        const fecha = r.fechaData?.timestamp || 0;
        if (r.adjudicaciones) {
            r.adjudicaciones.forEach(a => {
                if (!a.esFalso && a.clienteReal) {
                    const nombre = a.clienteReal;
                    if (!clientesMap[nombre]) {
                        clientesMap[nombre] = {
                            primeraAparicion: fecha,
                            fuentes: { adjudicaciones: 0, pujas: 0, garantias: 0 }
                        };
                    }
                    clientesMap[nombre].fuentes.adjudicaciones++;
                }
            });
        }
        if (r.posturasPorLote) {
            Object.values(r.posturasPorLote).forEach(pujas => {
                pujas.forEach(p => {
                    if (p.nombreNorm) {
                        const nombre = p.nombreNorm;
                        if (!clientesMap[nombre]) {
                            clientesMap[nombre] = {
                                primeraAparicion: fecha,
                                fuentes: { adjudicaciones: 0, pujas: 0, garantias: 0 }
                            };
                        }
                        clientesMap[nombre].fuentes.pujas++;
                    }
                });
            });
        }
        if (r.garantiasListaDetallada) {
            r.garantiasListaDetallada.forEach(g => {
                if (g.nombreNorm) {
                    const nombre = g.nombreNorm;
                    if (!clientesMap[nombre]) {
                        clientesMap[nombre] = {
                            primeraAparicion: fecha,
                            fuentes: { adjudicaciones: 0, pujas: 0, garantias: 0 }
                        };
                    }
                    clientesMap[nombre].fuentes.garantias++;
                }
            });
        }
    });
    return clientesMap;
}

function calcularKPIsMensuales(meses, clientesInfo, mesesKeys) {
    const resultados = [];
    let clientesAcumulados = new Set();
    mesesKeys.forEach((key, index) => {
        const mesData = meses[key];
        const clientesDelMes = new Set();
        const numRemates = mesData.remates.length;
        mesData.remates.forEach(r => {
            if (r.adjudicaciones) {
                r.adjudicaciones.forEach(a => {
                    if (!a.esFalso && a.clienteReal) {
                        clientesDelMes.add(a.clienteReal);
                    }
                });
            }
            if (r.posturasPorLote) {
                Object.values(r.posturasPorLote).forEach(pujas => {
                    pujas.forEach(p => {
                        if (p.nombreNorm) {
                            clientesDelMes.add(p.nombreNorm);
                        }
                    });
                });
            }
            if (r.garantiasListaDetallada) {
                r.garantiasListaDetallada.forEach(g => {
                    if (g.nombreNorm) {
                        clientesDelMes.add(g.nombreNorm);
                    }
                });
            }
        });
        const nuevosClientes = new Set();
        clientesDelMes.forEach(c => {
            if (!clientesAcumulados.has(c)) {
                nuevosClientes.add(c);
            }
        });
        const nuevosGanadores = new Set();
        const nuevosPujadores = new Set();
        const nuevosGarantes = new Set();
        mesData.remates.forEach(r => {
            if (r.adjudicaciones) {
                r.adjudicaciones.forEach(a => {
                    if (!a.esFalso && a.clienteReal && nuevosClientes.has(a.clienteReal)) {
                        nuevosGanadores.add(a.clienteReal);
                    }
                });
            }
            if (r.posturasPorLote) {
                Object.values(r.posturasPorLote).forEach(pujas => {
                    pujas.forEach(p => {
                        if (p.nombreNorm && nuevosClientes.has(p.nombreNorm)) {
                            nuevosPujadores.add(p.nombreNorm);
                        }
                    });
                });
            }
            if (r.garantiasListaDetallada) {
                r.garantiasListaDetallada.forEach(g => {
                    if (g.nombreNorm && nuevosClientes.has(g.nombreNorm)) {
                        nuevosGarantes.add(g.nombreNorm);
                    }
                });
            }
        });
        const ganadoresPorRemate = numRemates > 0 ? nuevosGanadores.size / numRemates : 0;
        const pujadoresPorRemate = numRemates > 0 ? nuevosPujadores.size / numRemates : 0;
        const garantesPorRemate = numRemates > 0 ? nuevosGarantes.size / numRemates : 0;
        let resultado = {
            mes: mesData.label,
            key: key,
            numRemates: numRemates,
            nuevosGanadores: nuevosGanadores.size,
            nuevosPujadores: nuevosPujadores.size,
            nuevosGarantes: nuevosGarantes.size,
            totalNuevos: nuevosClientes.size,
            ganadoresPorRemate: ganadoresPorRemate,
            pujadoresPorRemate: pujadoresPorRemate,
            garantesPorRemate: garantesPorRemate,
            ventaTotal: mesData.ventaTotal,
            bono: 0,
            kpis: {}
        };
        if (index > 0) {
            const mesAnterior = resultados[index - 1];
            const crecimientoVentas = mesAnterior.ventaTotal > 0 ? ((resultado.ventaTotal - mesAnterior.ventaTotal) / mesAnterior.ventaTotal) * 100 : 0;
            resultado.kpis = {
                ganadores: { valor: ganadoresPorRemate, meta: METAS_BONOS.ganadores, cumple: ganadoresPorRemate >= METAS_BONOS.ganadores },
                pujadores: { valor: pujadoresPorRemate, meta: METAS_BONOS.pujadores, cumple: pujadoresPorRemate >= METAS_BONOS.pujadores },
                garantes: { valor: garantesPorRemate, meta: METAS_BONOS.garantes, cumple: garantesPorRemate >= METAS_BONOS.garantes },
                ventas: { valor: crecimientoVentas, meta: METAS_BONOS.ventas, cumple: crecimientoVentas >= METAS_BONOS.ventas }
            };
            let bonoTotal = 0;
            if (resultado.kpis.ganadores.cumple) bonoTotal += 50000;
            if (resultado.kpis.pujadores.cumple) bonoTotal += 50000;
            if (resultado.kpis.garantes.cumple) bonoTotal += 50000;
            if (resultado.kpis.ventas.cumple) bonoTotal += 50000;
            resultado.bono = bonoTotal;
        }
        resultados.push(resultado);
        clientesAcumulados = new Set([...clientesAcumulados, ...clientesDelMes]);
    });
    return resultados;
}

function renderizarBonoActual(ultimoMes) {
    document.getElementById('bono-total-mes').innerText = formatMoney(ultimoMes.bono || 0);
    const cumplidos = ultimoMes.kpis ? Object.values(ultimoMes.kpis).filter(k => k.cumple).length : 0;
    document.getElementById('bono-kpis-cumplidos').innerText = `${cumplidos}/4`;
    document.getElementById('bono-nuevos-clientes').innerText = ultimoMes.totalNuevos || 0;
    const crecimientoVentas = ultimoMes.kpis?.ventas?.valor || 0;
    document.getElementById('bono-crecimiento-ventas').innerText = `${crecimientoVentas.toFixed(1)}%`;
    document.getElementById('bono-mes-label').innerText = `Mes: ${ultimoMes.mes} (${ultimoMes.numRemates} remates)`;
    const detalleContainer = document.getElementById('bono-kpis-detalle');
    if (ultimoMes.kpis) {
        const kpis = [
            { key: 'ganadores', label: '🏆 Nuevos Ganadores', data: ultimoMes.kpis.ganadores, extra: `${ultimoMes.nuevosGanadores} total / ${ultimoMes.numRemates} remates` },
            { key: 'pujadores', label: '📊 Nuevos Pujadores', data: ultimoMes.kpis.pujadores, extra: `${ultimoMes.nuevosPujadores} total / ${ultimoMes.numRemates} remates` },
            { key: 'garantes', label: '🛡️ Nuevos Garantes', data: ultimoMes.kpis.garantes, extra: `${ultimoMes.nuevosGarantes} total / ${ultimoMes.numRemates} remates` },
            { key: 'ventas', label: '💰 Crecimiento Ventas', data: ultimoMes.kpis.ventas, extra: `$${formatMoneyNumber(ultimoMes.ventaTotal)}` }
        ];
        detalleContainer.innerHTML = kpis.map(k => `
            <div class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div class="flex justify-between items-start">
                    <span class="text-[12px] font-bold text-gray-800">${k.label}</span>
                    <span class="text-[11px] font-bold ${k.data.cumple ? 'text-emerald-600' : 'text-red-500'}">
                        ${k.data.cumple ? '✅ Cumple' : '❌ No cumple'}
                    </span>
                </div>
                <div class="mt-1 flex items-center gap-2">
                    <span class="text-[14px] font-black ${k.data.cumple ? 'text-emerald-600' : 'text-red-500'}">
                        ${k.key === 'ventas' ? k.data.valor.toFixed(1) + '%' : k.data.valor.toFixed(1)}
                    </span>
                    <span class="text-[11px] text-gray-400">Meta: ${k.key === 'ventas' ? k.data.meta + '%' : k.data.meta}</span>
                </div>
                <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                    <div class="h-full rounded-full ${k.data.cumple ? 'bg-emerald-500' : 'bg-red-400'}" style="width: ${k.data.cumple ? 100 : Math.min(100, (k.data.valor / k.data.meta) * 100)}%"></div>
                </div>
                <div class="text-[9px] text-gray-400 mt-1">${k.extra}</div>
            </div>
        `).join('');
    } else {
        detalleContainer.innerHTML = `<div class="col-span-full text-center text-gray-400 py-4"><p class="text-sm font-medium">No hay datos suficientes para el primer mes</p></div>`;
    }
}

function formatMoneyNumber(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Math.round(Number(n)).toLocaleString('es-CL');
}

function renderizarHistorialBonos(resultados) {
    const tbody = document.getElementById('bono-historial-tabla');
    if (!resultados || resultados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400">Sin datos históricos</td></tr>`;
        return;
    }
    const historial = resultados.slice(-6);
    tbody.innerHTML = historial.map(m => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-3 py-2 font-medium text-gray-900">${m.mes}</td>
            <td class="px-3 py-2 text-center text-gray-500">${m.numRemates}</td>
            <td class="px-3 py-2 text-center ${m.kpis?.ganadores?.cumple ? 'text-emerald-600 font-bold' : 'text-gray-500'}">
                ${m.kpis?.ganadores ? (m.kpis.ganadores.cumple ? '✅' : '❌') : '-'}
                ${m.nuevosGanadores || 0}
            </td>
            <td class="px-3 py-2 text-center ${m.kpis?.pujadores?.cumple ? 'text-emerald-600 font-bold' : 'text-gray-500'}">
                ${m.kpis?.pujadores ? (m.kpis.pujadores.cumple ? '✅' : '❌') : '-'}
                ${m.nuevosPujadores || 0}
            </td>
            <td class="px-3 py-2 text-center ${m.kpis?.garantes?.cumple ? 'text-emerald-600 font-bold' : 'text-gray-500'}">
                ${m.kpis?.garantes ? (m.kpis.garantes.cumple ? '✅' : '❌') : '-'}
                ${m.nuevosGarantes || 0}
            </td>
            <td class="px-3 py-2 text-center ${m.kpis?.ventas?.cumple ? 'text-emerald-600 font-bold' : 'text-gray-500'}">
                ${m.kpis?.ventas ? (m.kpis.ventas.cumple ? '✅' : '❌') : '-'}
                ${m.kpis?.ventas ? m.kpis.ventas.valor.toFixed(1) + '%' : '-'}
            </td>
            <td class="px-3 py-2 text-right font-bold text-emerald-600">${formatMoney(m.bono || 0)}</td>
        </tr>
    `).join('');
}

// ============================================================
// MÓDULO: FEEDBACK (CHAT)
// ============================================================
function procesarFeedback() {
    feedbackMessages = [];
    const allRemates = getSelectedRemates();
    allRemates.forEach(r => {
        if (r.chatMessages && Array.isArray(r.chatMessages)) {
            r.chatMessages.forEach(msg => {
                feedbackMessages.push({
                    ...msg,
                    remate: window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp),
                    remateId: r.id
                });
            });
        }
    });
    feedbackMessages.sort((a,b) => (a.fecha || 0) - (b.fecha || 0));
}

window.renderFeedback = function() {
    if (currentModule !== 'feedback') return;

    const container = document.getElementById('feedback-timeline');
    const totalMsg = document.getElementById('feedback-total-msg');
    const usuariosSelect = document.getElementById('filter-feedback-usuario');

    if (!feedbackMessages || feedbackMessages.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-gray-400 font-medium">No hay mensajes de feedback en los remates seleccionados.</div>';
        totalMsg.innerText = '0';
        usuariosSelect.innerHTML = '<option value="todos">Todos los usuarios</option>';
        document.getElementById('feedback-top-usuarios').innerHTML = '<p class="text-gray-400 text-[11px]">Sin datos</p>';
        document.getElementById('feedback-top-palabras').innerHTML = '<span class="text-gray-400 text-[11px]">Sin datos</span>';
        return;
    }

    totalMsg.innerText = feedbackMessages.length;

    // Poblar select de usuarios
    const usuarios = [...new Set(feedbackMessages.map(m => m.usuario || 'Anónimo'))];
    usuariosSelect.innerHTML = '<option value="todos">Todos los usuarios</option>' +
        usuarios.map(u => `<option value="${u}">${u}</option>`).join('');

    window.filtrarFeedback();

    // Top usuarios
    const userCount = {};
    feedbackMessages.forEach(m => {
        const u = m.usuario || 'Anónimo';
        userCount[u] = (userCount[u] || 0) + 1;
    });
    const topUsers = Object.entries(userCount).sort((a,b) => b[1] - a[1]).slice(0,10);
    document.getElementById('feedback-top-usuarios').innerHTML = topUsers.map(([u, c]) =>
        `<div class="flex justify-between text-[12px]"><span class="text-gray-700">${u}</span><span class="font-bold text-gray-900">${c}</span></div>`
    ).join('') || '<p class="text-gray-400 text-[11px]">Sin datos</p>';

    // Palabras clave
    const palabras = {};
    const stopWords = ['que', 'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'las', 'un', 'por', 'con', 'no', 'su', 'para', 'es', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'este', 'entre', 'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'tres', 'nos', 'una', 'sin', 'sobre', 'se', 'me', 'te', 'lo', 'mi'];
    feedbackMessages.forEach(m => {
        const texto = (m.mensaje || m.texto || '').toLowerCase();
        texto.split(/[^a-záéíóúñ0-9]+/).forEach(p => {
            if (p.length > 3 && !stopWords.includes(p)) {
                palabras[p] = (palabras[p] || 0) + 1;
            }
        });
    });
    const topPalabras = Object.entries(palabras).sort((a,b) => b[1] - a[1]).slice(0,15);
    document.getElementById('feedback-top-palabras').innerHTML = topPalabras.map(([p, c]) =>
        `<span class="px-3 py-1 bg-gray-100 rounded-full text-[11px] text-gray-700">${p} <span class="text-gray-400">${c}</span></span>`
    ).join('') || '<span class="text-gray-400 text-[11px]">Sin datos</span>';
};

window.filtrarFeedback = function() {
    const term = (document.getElementById('search-feedback')?.value || '').toLowerCase();
    const usuario = document.getElementById('filter-feedback-usuario')?.value || 'todos';

    let filtered = feedbackMessages;
    if (term) {
        filtered = filtered.filter(m => (m.mensaje || m.texto || '').toLowerCase().includes(term));
    }
    if (usuario !== 'todos') {
        filtered = filtered.filter(m => (m.usuario || 'Anónimo') === usuario);
    }

    const container = document.getElementById('feedback-timeline');
    if (!filtered.length) {
        container.innerHTML = '<div class="p-8 text-center text-gray-400 font-medium">No hay mensajes que coincidan con los filtros.</div>';
        return;
    }

    container.innerHTML = filtered.map(m => {
        const esQueja = (m.mensaje || m.texto || '').toLowerCase().includes('queja') ||
                       (m.mensaje || m.texto || '').toLowerCase().includes('problema') ||
                       (m.mensaje || m.texto || '').toLowerCase().includes('error') ||
                       (m.mensaje || m.texto || '').toLowerCase().includes('malo') ||
                       (m.mensaje || m.texto || '').toLowerCase().includes('no sirve');
        const esPositivo = (m.mensaje || m.texto || '').toLowerCase().includes('gracias') ||
                          (m.mensaje || m.texto || '').toLowerCase().includes('excelente') ||
                          (m.mensaje || m.texto || '').toLowerCase().includes('bueno');
        let badge = '';
        if (esQueja) badge = '<span class="ml-2 text-[10px] font-bold text-red-500">⚠️ Queja</span>';
        if (esPositivo) badge = '<span class="ml-2 text-[10px] font-bold text-emerald-500">✅ Positivo</span>';

        return `
        <div class="px-4 py-3 hover:bg-gray-50 transition flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[14px] font-bold text-gray-600 flex-shrink-0">
                ${(m.usuario || 'A')[0].toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-bold text-gray-900 text-[13px]">${m.usuario || 'Anónimo'}</span>
                    <span class="text-[10px] text-gray-400">${m.fecha ? window.formatExcelDate(m.fecha) : '-'}</span>
                    <span class="text-[10px] text-gray-400">• ${m.remate || 'Remate'}</span>
                    ${badge}
                </div>
                <p class="text-[13px] text-gray-700 mt-0.5">${m.mensaje || m.texto || ''}</p>
            </div>
        </div>`;
    }).join('');
};

window.exportarFeedbackExcel = function() {
    try {
        if (!feedbackMessages || feedbackMessages.length === 0) {
            alert('No hay mensajes de feedback para exportar.');
            return;
        }
        const wsData = feedbackMessages.map(m => ({
            "Remate": m.remate || 'Remate',
            "Fecha": m.fecha ? window.formatExcelDate(m.fecha) : '-',
            "Usuario": m.usuario || 'Anónimo',
            "Mensaje": m.mensaje || m.texto || '',
            "Tipo": (m.mensaje || m.texto || '').toLowerCase().includes('queja') ? 'Queja' :
                    (m.mensaje || m.texto || '').toLowerCase().includes('gracias') ? 'Positivo' : 'Neutral'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Feedback");
        XLSX.writeFile(wb, `Feedback_Usuarios_${new Date().getTime()}.xlsx`);
    } catch(e) { console.error(e); }
};

// ============================================================
// PROCESAMIENTO DE EXCEL (PARSE) - MEJORADO PARA RETAIL
// ============================================================
window.parseExcel = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});

                let sheetAdjName = workbook.SheetNames.find(s => String(s).toLowerCase().includes('adjudicaciones')) || workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetAdjName];
                const rowsAdj = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});

                let fechaData = extraerFechaInfo(file, rowsAdj);
                let tipo = 'Siniestrados';
                for (let i = 0; i < Math.min(rowsAdj.length, 10); i++) {
                    const row = rowsAdj[i];
                    if (row && row.length > 0 && row[0]) {
                        const cellStr = String(row[0]).toUpperCase();
                        if (cellStr.includes('RETAIL')) {
                            tipo = 'Retail';
                            break;
                        }
                    }
                }
                if (tipo === 'Siniestrados' && file.name.toLowerCase().includes('retail')) {
                    tipo = 'Retail';
                }

                let maxScore = 0;
                let headerIdx = 0;
                let headers = [];
                for(let i=0; i<Math.min(rowsAdj.length, 20); i++){
                    if(!rowsAdj[i] || !Array.isArray(rowsAdj[i])) continue;
                    let rowStr = rowsAdj[i].map(c => String(c).toLowerCase().trim()).join(' ');
                    let score = 0;
                    if(rowStr.includes('rut')) score++;
                    if(rowStr.includes('nombre') || rowStr.includes('cliente') || rowStr.includes('adjudicatario')) score++;
                    if(rowStr.includes('monto') || rowStr.includes('adjudicad') || rowStr.includes('total')) score++;
                    if(rowStr.includes('lote') || rowStr.includes('numero')) score++;
                    if(rowStr.includes('patente') || rowStr.includes('descripci') || rowStr.includes('vehiculo')) score++;
                    if(score > maxScore) {
                        maxScore = score;
                        headerIdx = i;
                        headers = rowsAdj[i].map(c => String(c).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                }
                if(headers.length === 0 && rowsAdj.length > 0) {
                    headers = rowsAdj[0].map(c => String(c).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ''));
                }

                let parsedData = [];
                for(let i = headerIdx + 1; i < rowsAdj.length; i++) {
                    let rowData = rowsAdj[i];
                    if(!rowData || !Array.isArray(rowData) || rowData.join('').trim() === '') continue;
                    let obj = {};
                    for(let j = 0; j < headers.length; j++) {
                        let key = headers[j] || ('col' + j);
                        obj[key] = rowData[j];
                    }
                    parsedData.push(obj);
                }

                let remate = {
                    fileName: file.name,
                    fechaData: fechaData,
                    tipo: tipo,
                    ventaTotal: 0,
                    comisionTotal: 0,
                    lotesCount: 0,
                    lotesDisponibles: 0,
                    inscritos: 0,
                    garantias: 0,
                    garantiasEmailsReales: [],
                    garantiasListaDetallada: [],
                    adjudicaciones: [],
                    posturasPorLote: {},
                    chatMessages: []
                };

                let lotesSet = new Set();
                let garantiasSet = new Set();
                let pujasPorLote = {};

                parsedData.forEach(rowNorm => {
                    try {
                        let numVal = String(rowNorm['numero'] || rowNorm['nrolote'] || rowNorm['nlote'] || rowNorm['item'] || rowNorm['id'] || '').replace(/\D/g, '');
                        let nombre = rowNorm['nombre'] || rowNorm['adjudicatario'] || rowNorm['cliente'] || rowNorm['nombresorazonsocial'] || rowNorm['razonsocial'] || '';
                        let montoRaw = rowNorm['montoadjudicacion'] || rowNorm['totaladjudicacion'] || rowNorm['montoadjudicado'] || rowNorm['totaladjudicado'] || rowNorm['monto'] || rowNorm['adjudicado'] || rowNorm['total'] || rowNorm['valor'] || rowNorm['precio'] || 0;
                        let minimoRaw = rowNorm['minimo'] || rowNorm['preciobase'] || rowNorm['base'] || rowNorm['montoautorizado'] || rowNorm['valorbase'] || rowNorm['montominimo'] || rowNorm['montoestimado'] || 0;
                        let rut = rowNorm['rut'] || rowNorm['nrorut'] || rowNorm['rutcliente'] || '';
                        let email = rowNorm['email'] || rowNorm['correo'] || rowNorm['correoelectronico'] || '';
                        let monto = typeof montoRaw === 'number' ? montoRaw : parseFloat(String(montoRaw).replace(/[^\d]/g, '')) || 0;
                        let minimo = typeof minimoRaw === 'number' ? minimoRaw : parseFloat(String(minimoRaw).replace(/[^\d]/g, '')) || 0;
                        let textLote = String(rowNorm['lote'] || '').trim();
                        let textDetalle = String(rowNorm['detalle'] || '').trim();
                        let textDesc = String(rowNorm['descripcion'] || '').trim();
                        let textEstado = String(rowNorm['estado'] || '').trim();
                        let patente = rowNorm['patente'] || '';
                        let vehiculoText = '';

                        if (textLote.includes(':')) {
                            let parts = textLote.split(':');
                            if(!patente) patente = parts[0].trim();
                            vehiculoText = parts[1].trim();
                        } else {
                            vehiculoText = textLote;
                        }
                        if (!patente && textDetalle.includes('Patente')) {
                            let match = textDetalle.match(/Patente<\/b><\/td><td[^>]*>:<\/td><td>([^<]+)/i);
                            if (match && match[1]) patente = match[1].trim();
                        }
                        if (!vehiculoText || vehiculoText.length < 4) {
                            let matchMarca = textDetalle.match(/Marca<\/b><\/td><td[^>]*>:<\/td><td>([^<]+)/i);
                            let matchModelo = textDetalle.match(/Modelo<\/b><\/td><td[^>]*>:<\/td><td>([^<]+)/i);
                            let marca = matchMarca && matchMarca[1] ? matchMarca[1].trim() : '';
                            let modelo = matchModelo && matchModelo[1] ? matchModelo[1].trim() : '';
                            vehiculoText = `${marca} ${modelo}`.trim();
                        }
                        vehiculoText = vehiculoText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                        let extraDesc = textDesc + " " + textEstado;

                        if (numVal || vehiculoText) {
                            lotesSet.add(String(numVal || vehiculoText).trim());
                            let esFalso = esClienteFalso(nombre, email);
                            let esChatarra = extraDesc.toLowerCase().includes('chatarra') || String(vehiculoText).toLowerCase().includes('chatarra') || String(vehiculoText).toLowerCase().includes('restos');
                            let { categoria, modeloStr } = extraerMarcaModelo(String(vehiculoText));

                            if(monto > 0 && nombre) {
                                remate.adjudicaciones.push({
                                    numeroLote: numVal,
                                    loteStr: vehiculoText,
                                    patente: String(patente).trim().toUpperCase(),
                                    nombreRaw: nombre,
                                    clienteReal: normalizarCliente(nombre),
                                    rut: rut,
                                    email: email,
                                    minimo: minimo,
                                    monto: monto,
                                    esFalso: esFalso,
                                    esChatarra: esChatarra,
                                    categoria: categoria,
                                    modeloStr: modeloStr,
                                    pujadoresRealesCount: 0
                                });
                                if (!esFalso) {
                                    remate.ventaTotal += monto;
                                    remate.lotesCount++;
                                    if (email && !remate.garantiasEmailsReales.includes(String(email).trim())) {
                                        remate.garantiasEmailsReales.push(String(email).trim());
                                    }
                                    let clienteKey = normalizarCliente(nombre) + String(email).trim().toLowerCase();
                                    if (!garantiasSet.has(clienteKey)) {
                                        garantiasSet.add(clienteKey);
                                        remate.garantiasListaDetallada.push({
                                            nombreNorm: normalizarCliente(nombre),
                                            nombre: String(nombre),
                                            email: String(email),
                                            rut: String(rut),
                                            fechaRemate: fechaData.timestamp,
                                            numRemate: String(numVal),
                                            montoGarantia: 0
                                        });
                                    }
                                }
                            }
                        }
                    } catch(e) {}
                });

                remate.lotesDisponibles = lotesSet.size > 0 ? lotesSet.size : remate.adjudicaciones.length;

                // GARANTÍAS
                let sheetGarantiasName = workbook.SheetNames.find(s => String(s).toLowerCase() === 'garantías' || String(s).toLowerCase() === 'garantias');
                if (sheetGarantiasName) {
                    try {
                        const wsGarantias = workbook.Sheets[sheetGarantiasName];
                        const rowsGarantias = XLSX.utils.sheet_to_json(wsGarantias, {header: 1, defval: ""});
                        let garantiasCount = 0;
                        let headerGIdx = -1;
                        let gHeaders = [];
                        for(let i=0; i<Math.min(rowsGarantias.length, 15); i++){
                            if(!rowsGarantias[i] || !Array.isArray(rowsGarantias[i])) continue;
                            let rowStr = rowsGarantias[i].map(c => String(c).toLowerCase().trim()).join(' ');
                            if((rowStr.includes('rut') || rowStr.includes('cliente') || rowStr.includes('nombre')) &&
                               (rowStr.includes('monto') || rowStr.includes('garantia') || rowStr.includes('email'))) {
                                headerGIdx = i;
                                gHeaders = rowsGarantias[i].map(c => String(c).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ''));
                                break;
                            }
                        }
                        if(headerGIdx !== -1) {
                            for(let i = headerGIdx + 1; i < rowsGarantias.length; i++) {
                                let rowData = rowsGarantias[i];
                                if(!rowData || !Array.isArray(rowData) || rowData.join('').trim() === '') continue;
                                let obj = {};
                                for(let j = 0; j < gHeaders.length; j++) {
                                    obj[gHeaders[j] || ('col' + j)] = rowData[j];
                                }
                                let email = obj['email'] || obj['correo'];
                                let nombre = obj['nombre'] || obj['nombresorazonsocial'] || obj['cliente'] || obj['titular'] || obj['razonsocial'];
                                let rut = obj['rut'] || obj['rutcliente'];
                                let montoGarantia = parseFloat(String(obj['montogarantía'] || obj['montogarantia'] || obj['monto'] || 0).replace(/[^\d]/g, '')) || 0;
                                if(nombre && !esClienteFalso(nombre, email)) {
                                    garantiasCount++;
                                    remate.garantiasListaDetallada.push({
                                        nombreNorm: normalizarCliente(nombre),
                                        nombre: String(nombre),
                                        email: String(email),
                                        rut: String(rut),
                                        fechaRemate: fechaData.timestamp,
                                        numRemate: "",
                                        montoGarantia: montoGarantia
                                    });
                                }
                            }
                        }
                        if(garantiasCount > remate.garantiasListaDetallada.length) {
                            remate.garantias = garantiasCount;
                        } else {
                            remate.garantias = remate.garantiasListaDetallada.length;
                        }
                    } catch(e) {}
                } else {
                    remate.garantias = remate.garantiasListaDetallada.length;
                }

                // POSTURAS (PUJAS) - AHORA CONTANDO BIEN
                let sheetPosturasName = workbook.SheetNames.find(s => String(s).toLowerCase().includes('posturas') || String(s).toLowerCase().includes('pujas'));
                if (sheetPosturasName) {
                    try {
                        const wsPosturas = workbook.Sheets[sheetPosturasName];
                        const rowsPosturas = XLSX.utils.sheet_to_json(wsPosturas, {header: 1, defval: ""});
                        let headerPIdx = -1;
                        let pHeaders = [];
                        for(let i=0; i<Math.min(rowsPosturas.length, 20); i++){
                            if(!rowsPosturas[i] || !Array.isArray(rowsPosturas[i])) continue;
                            let rowStr = rowsPosturas[i].map(c => String(c).toLowerCase().trim()).join(' ');
                            if((rowStr.includes('rut') || rowStr.includes('nombre') || rowStr.includes('cliente')) &&
                               (rowStr.includes('postura') || rowStr.includes('monto') || rowStr.includes('oferta'))) {
                                headerPIdx = i;
                                pHeaders = rowsPosturas[i].map(c => String(c).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ''));
                                break;
                            }
                        }
                        if(headerPIdx !== -1) {
                            let parseMoney = (val) => {
                                if(!val) return 0;
                                if(typeof val === 'number') return val;
                                let str = String(val).trim().toUpperCase();
                                if(str.includes('M')) {
                                    let n = parseFloat(str.replace(/[^\d,.-]/g, '').replace(',', '.'));
                                    return (n || 0) * 1000000;
                                }
                                let intPart = str.split(',')[0].replace(/[^\d-]/g, '');
                                return parseInt(intPart, 10) || 0;
                            };
                            for(let i = headerPIdx + 1; i < rowsPosturas.length; i++) {
                                let rowData = rowsPosturas[i];
                                if(!rowData || !Array.isArray(rowData) || rowData.join('').trim() === '') continue;
                                let obj = {};
                                for(let j = 0; j < pHeaders.length; j++) {
                                    obj[pHeaders[j] || ('col' + j)] = rowData[j];
                                }
                                let nombreP = obj['nombre'] || obj['nombresorazonsocial'] || obj['cliente'] || obj['adjudicatario'];
                                let montoRawP = obj['postura'] || obj['monto'] || obj['oferta'] || obj['valor'];
                                let montoP = parseMoney(montoRawP);
                                let emailP = obj['email'] || obj['correo'] || '';
                                let rutP = obj['rut'] || obj['rutcliente'] || '';
                                let loteRaw = String(obj['lote'] || obj['detalle'] || obj['descripcion'] || '').replace(/<[^>]+>/g, '').trim();
                                let numP = String(obj['numero'] || obj['nrolote'] || '').replace(/\D/g, '');
                                if (!numP && loteRaw) {
                                    let matchLoteP = loteRaw.match(/^(\d+)\s/);
                                    if(matchLoteP) numP = matchLoteP[1];
                                }
                                if(montoP > 0 && nombreP) {
                                    let isFalso = esClienteFalso(nombreP, emailP);
                                    let puja = {
                                        nombre: String(nombreP),
                                        nombreNorm: normalizarCliente(nombreP),
                                        monto: montoP,
                                        email: emailP,
                                        rut: rutP,
                                        esFalso: isFalso,
                                        fecha: fechaData.timestamp
                                    };
                                    let matchAdj = remate.adjudicaciones.find(a => {
                                        let matchStr = a.loteStr && loteRaw && loteRaw.includes(a.loteStr);
                                        let matchNum = a.numeroLote && numP && a.numeroLote === numP;
                                        return matchStr || matchNum;
                                    });
                                    if (matchAdj) {
                                        let loteKey = matchAdj.loteStr;
                                        if (!remate.posturasPorLote[loteKey]) remate.posturasPorLote[loteKey] = [];
                                        remate.posturasPorLote[loteKey].push(puja);
                                        // ACTUALIZAR CONTADOR DE PUJAS REALES
                                        if (!isFalso) {
                                            matchAdj.pujadoresRealesCount = (matchAdj.pujadoresRealesCount || 0) + 1;
                                        }
                                    } else if (loteRaw) {
                                        if (!remate.posturasPorLote[loteRaw]) remate.posturasPorLote[loteRaw] = [];
                                        remate.posturasPorLote[loteRaw].push(puja);
                                    } else if (numP) {
                                        if (!remate.posturasPorLote[numP]) remate.posturasPorLote[numP] = [];
                                        remate.posturasPorLote[numP].push(puja);
                                    }
                                }
                            }
                        }
                    } catch(e) {}
                }

                // CHAT
                let sheetChatName = workbook.SheetNames.find(s => String(s).toLowerCase().includes('chat'));
                if (sheetChatName) {
                    try {
                        const wsChat = workbook.Sheets[sheetChatName];
                        const rowsChat = XLSX.utils.sheet_to_json(wsChat, {header: 1, defval: ""});
                        let headerCIdx = -1;
                        let cHeaders = [];
                        for(let i=0; i<Math.min(rowsChat.length, 10); i++){
                            if(!rowsChat[i] || !Array.isArray(rowsChat[i])) continue;
                            let rowStr = rowsChat[i].map(c => String(c).toLowerCase().trim()).join(' ');
                            if(rowStr.includes('mensaje') || rowStr.includes('usuario') || rowStr.includes('fecha')) {
                                headerCIdx = i;
                                cHeaders = rowsChat[i].map(c => String(c).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ''));
                                break;
                            }
                        }
                        if(headerCIdx !== -1) {
                            for(let i = headerCIdx + 1; i < rowsChat.length; i++) {
                                let rowData = rowsChat[i];
                                if(!rowData || !Array.isArray(rowData) || rowData.join('').trim() === '') continue;
                                let obj = {};
                                for(let j = 0; j < cHeaders.length; j++) {
                                    obj[cHeaders[j] || ('col' + j)] = rowData[j];
                                }
                                let mensaje = obj['mensaje'] || obj['texto'] || '';
                                let usuario = obj['usuario'] || 'Anónimo';
                                let fecha = obj['fecha'] || fechaData.timestamp;
                                if (mensaje) {
                                    remate.chatMessages.push({ mensaje, usuario, fecha });
                                }
                            }
                        }
                    } catch(e) {}
                }

                remate.inscritos = remate.garantias + Math.floor(remate.garantias * 0.1);
                remate.comisionTotal = remate.ventaTotal * 0.12;

                resolve(remate);
            } catch(error) {
                console.error(error);
                reject(error);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// ============================================================
// CARGA DE ARCHIVOS (SOPORTE PARA CARPETA)
// ============================================================
const dropZone = document.getElementById('drop-zone');

document.body.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

document.body.addEventListener('dragleave', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
});

document.body.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const items = e.dataTransfer.items;
    const allFiles = [];
    if(items) {
        const promises = [];
        for(let i=0; i<items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if(item) promises.push(traverseFileTree(item, allFiles));
        }
        await Promise.all(promises);
    } else {
        allFiles.push(...e.dataTransfer.files);
    }
    window.iniciarProcesamiento(allFiles);
});

function traverseFileTree(item, filesArray) {
    return new Promise(resolve => {
        if(item.isFile) {
            item.file(file => {
                filesArray.push(file);
                resolve();
            });
        } else if(item.isDirectory) {
            const dirReader = item.createReader();
            const entries = [];
            const readEntries = () => {
                dirReader.readEntries(async results => {
                    if(!results.length) {
                        for(let entry of entries) {
                            await traverseFileTree(entry, filesArray);
                        }
                        resolve();
                    } else {
                        entries.push(...results);
                        readEntries();
                    }
                });
            };
            readEntries();
        } else {
            resolve();
        }
    });
}

window.iniciarProcesamiento = async function(files) {
    const validFiles = Array.from(files).filter(f => f.name.match(/\.xlsx?$|\.xls$/i) && !f.name.startsWith('~$') && !f.name.includes('__MACOSX'));
    if(!validFiles.length) return;

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');

    let successCount = 0;
    let upsertQueue = [];

    for(let i = 0; i < validFiles.length; i++) {
        loadingText.innerText = `Analizando Matriz ${i+1} de ${validFiles.length}...`;
        await new Promise(r => setTimeout(r, 20));
        try {
            const data = await window.parseExcel(validFiles[i]);
            if(data) {
                const existsIdx = db.remates.findIndex(r => r.fileName === data.fileName || window.formatearNombreRemate(r.fileName, r.fechaData?.timestamp) === window.formatearNombreRemate(data.fileName, data.fechaData?.timestamp));
                if (existsIdx >= 0) {
                    data._dbId = db.remates[existsIdx]._dbId;
                    data.id = db.remates[existsIdx].id;
                    db.remates[existsIdx] = data;
                } else {
                    data._dbId = Math.floor(Math.random() * 2000000000);
                    data.id = 'UID-' + window.formatearNombreRemate(data.fileName, data.fechaData?.timestamp).replace(/[^a-zA-Z0-9]/g, '');
                    db.remates.push(data);
                }
                upsertQueue.push({ id: data._dbId, payload: data });
                successCount++;
            }
        } catch(err) {
            console.error("Error:", err);
        }
    }

    if(successCount === 0) {
        loadingOverlay.classList.remove('flex');
        loadingOverlay.classList.add('hidden');
        document.getElementById('db-status').innerText = `Error: Archivos Inválidos`;
        return;
    }

    loadingText.innerText = "Sincronizando Cruces...";
    await new Promise(r => setTimeout(r, 20));

    db.remates.sort((a,b) => (a.fechaData?.timestamp || 0) - (b.fechaData?.timestamp || 0));

    let clientesGlobales = [];
    let adjudicatariosGlobales = [];

    db.remates.forEach(remate => {
        let nuevos = 0, antiguos = 0;
        remate.garantiasEmailsReales.forEach(email => {
            if(clientesGlobales.includes(email)) {
                antiguos++;
            } else {
                nuevos++;
                clientesGlobales.push(email);
            }
        });
        remate.nuevos = nuevos;
        remate.antiguos = antiguos;
        let ganadoresNuevos = 0;
        let ventaNuevos = 0;
        let ventaAntiguos = 0;
        let statusCliente = {};
        const ganadoresUnicos = [...new Set(remate.adjudicaciones.filter(a => !a.esFalso).map(a => a.clienteReal))];
        ganadoresUnicos.forEach(cliente => {
            if(adjudicatariosGlobales.includes(cliente)) {
                statusCliente[cliente] = 'antiguo';
            } else {
                ganadoresNuevos++;
                adjudicatariosGlobales.push(cliente);
                statusCliente[cliente] = 'nuevo';
            }
        });
        remate.adjudicaciones.forEach(a => {
            if(!a.esFalso) {
                if(statusCliente[a.clienteReal] === 'nuevo') {
                    ventaNuevos += a.monto;
                } else {
                    ventaAntiguos += a.monto;
                }
            }
        });
        remate.ganadoresNuevos = ganadoresNuevos;
        remate.ventaNuevos = ventaNuevos;
        remate.ventaAntiguos = ventaAntiguos;
        remate.ganadoresUnicosCount = ganadoresUnicos.length;
    });

    try {
        for (let i = 0; i < upsertQueue.length; i++) {
            loadingText.innerText = `Subiendo a la Nube (${i+1}/${upsertQueue.length})...`;
            const { error } = await supabaseClient.from('app_state').upsert(upsertQueue[i]);
            if (error) throw error;
            await new Promise(r => setTimeout(r, 50));
        }
        document.getElementById('db-status').innerHTML = `<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> En Línea (${db.remates.length})`;
    } catch (e) {
        document.getElementById('db-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Error BD';
        alert("Error de guardado en la nube: " + e.message);
    }

    document.getElementById('file-input').value = "";
    window.actualizarFiltrosGlobales();
    procesarDatosClientes();
    window.actualizarEstadoApp();
    loadingOverlay.classList.remove('flex');
    loadingOverlay.classList.add('hidden');
};

// ============================================================
// VACIAR BASE DE DATOS
// ============================================================
window.limpiarBase = async function() {
    if (!confirm('¿Estás seguro de vaciar TODA la base de datos en la nube? Esta acción no se puede deshacer.')) {
        return;
    }
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
    loadingText.innerText = 'Vaciando base de datos...';
    try {
        const { error } = await supabaseClient.from('app_state').delete().neq('id', 0);
        if (error) throw error;
        db = { remates: [] };
        checkedNodes = [];
        clientDB = [];
        clientesLatentes = [];
        feedbackMessages = [];
        window.globalSelectedYears = [];
        document.getElementById('db-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Base Vacía';
        window.actualizarFiltrosGlobales();
        window.actualizarEstadoApp();
        alert('Base de datos vaciada correctamente.');
    } catch (e) {
        alert('Error al vaciar la base: ' + e.message);
        document.getElementById('db-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Error BD';
    } finally {
        loadingOverlay.classList.add('hidden');
        loadingOverlay.classList.remove('flex');
    }
};

// ============================================================
// MODALES
// ============================================================
window.abrirModalMultiLote = function() {
    let html = '';
    Object.entries(globalMapCMulti).sort((a,b) => b[1].lotes - a[1].lotes).forEach(([nombre, data]) => {
        if(data.lotes > 1) {
            html += `
            <tr>
                <td class="pl-5 py-2 font-bold text-gray-900">${nombre}</td>
                <td class="text-center py-2 font-black text-gray-700">${data.lotes}</td>
                <td class="text-right pr-5 py-2 font-black text-emerald-600">${formatMoney(data.total)}</td>
            </tr>`;
        }
    });
    document.getElementById('modal-tabla-multilote').innerHTML = html || '<tr><td colspan="3" class="p-8 text-center text-gray-500 font-medium">Ningún cliente se adjudicó más de 1 lote.</td></tr>';
    document.getElementById('modal-multilote').classList.remove('hidden');
    document.getElementById('modal-multilote').classList.add('flex');
};

window.cerrarModalMulti = function(e) {
    if(e && e.target.id !== 'modal-multilote') return;
    document.getElementById('modal-multilote').classList.add('hidden');
    document.getElementById('modal-multilote').classList.remove('flex');
};

window.abrirModalFuga = function() {
    try {
        if(!globalAgg) return;
        let html = '';
        if(globalAgg.fugaList && globalAgg.fugaList.length > 0) {
            globalAgg.fugaList.sort((a,b) => a.nombre.localeCompare(b.nombre));
            let hoy = Date.now();
            globalAgg.fugaList.forEach(f => {
                let diasFuga = f.fechaRemate ? Math.floor((hoy - f.fechaRemate) / (1000 * 60 * 60 * 24)) : 0;
                let textoDias = f.fechaRemate ? `${diasFuga} d` : '-';
                let nombreRemate = window.formatearNombreRemate(`Remate ${f.numRemate||''}`, f.fechaRemate);
                html += `
                <tr class="hover:bg-gray-50">
                    <td class="pl-5 py-2 font-medium text-gray-900 truncate max-w-[150px]">${nombreRemate}</td>
                    <td class="py-2 text-red-500 font-bold">${textoDias}</td>
                    <td class="py-2 font-bold text-gray-900 truncate max-w-[200px]">${f.nombre}</td>
                </tr>`;
            });
        } else {
            html = '<tr><td colspan="3" class="p-8 text-center text-gray-500 font-medium">No hay registros de fuga.</td></tr>';
        }
        document.getElementById('modal-tabla-fuga').innerHTML = html;
        document.getElementById('modal-fuga').classList.remove('hidden');
        document.getElementById('modal-fuga').classList.add('flex');
    } catch (e) {}
};

window.cerrarModalFuga = function(e) {
    if(e && e.target.id !== 'modal-fuga') return;
    document.getElementById('modal-fuga').classList.add('hidden');
    document.getElementById('modal-fuga').classList.remove('flex');
};

window.exportarFugaExcel = function() {
    try {
        if(!globalAgg || !globalAgg.fugaList) return;
        let hoy = Date.now();
        const wsData = globalAgg.fugaList.map(f => {
            let diasFuga = f.fechaRemate ? Math.floor((hoy - f.fechaRemate) / (1000 * 60 * 60 * 24)) : 0;
            let nombreRemate = window.formatearNombreRemate(`Remate ${f.numRemate||''}`, f.fechaRemate);
            return {
                "Matriz": nombreRemate,
                "Días Inactivo": diasFuga,
                "Fecha": f.fechaRemate ? window.formatExcelDate(f.fechaRemate) : '-',
                "Cliente": f.nombre,
                "RUT": f.rut || 'No Registrado',
                "Email": f.email || 'No Registrado'
            };
        });
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Lista_Negra");
        XLSX.writeFile(wb, `Listado_Fuga_${new Date().getTime()}.xlsx`);
    } catch (e) {}
};

window.abrirModalPujadores = function(loteEncoded, nodeId) {
    try {
        const loteStr = decodeURIComponent(loteEncoded);
        let remate = db.remates.find(r => r.id === nodeId);
        if(!remate) return;
        let todasPujas = remate.posturasPorLote ? (remate.posturasPorLote[loteStr] || []) : [];
        let adjudicado = remate.adjudicaciones ? remate.adjudicaciones.find(a => a.loteStr === loteStr) : null;
        currentAdjudicadoModal = adjudicado;
        currentModalPujas = todasPujas.sort((a,b) => b.monto - a.monto);
        document.getElementById('modal-subtitulo').innerText = `Adj: ${adjudicado && !adjudicado.esFalso ? formatMoney(adjudicado.monto) : 'FALSO'} | Min: ${adjudicado ? formatMoney(adjudicado.minimo) : '-'}`;
        document.getElementById('modal-total-pujas').innerText = todasPujas.length;
        document.getElementById('modal-unicos-reales').innerText = [...new Set(todasPujas.filter(p => !p.esFalso).map(p => p.nombreNorm))].length;
        currentFiltroModal = 'todos';
        document.getElementById('btn-filtro-todos').className = 'px-3 py-1.5 rounded-md bg-black text-white transition';
        document.getElementById('btn-filtro-reales').className = 'px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:text-black transition';
        renderModalTabla();
        document.getElementById('modal-pujadores').classList.remove('hidden');
        document.getElementById('modal-pujadores').classList.add('flex');
    } catch(e) { console.error("Error modal pujas:", e); }
};

function renderModalTabla() {
    try {
        let lista = currentModalPujas;
        let adjudicado = currentAdjudicadoModal;
        if(currentFiltroModal === 'reales') lista = lista.filter(p => !p.esFalso);
        if(currentFiltroModal === 'falsos') lista = lista.filter(p => p.esFalso);
        document.getElementById('modal-tabla-pujas').innerHTML = lista.map((p,i) => {
            let esAdj = adjudicado && !adjudicado.esFalso && p.nombre.toUpperCase().includes(adjudicado.nombreRaw.split(' ')[0]) && Math.abs(p.monto - adjudicado.monto) < 1000;
            let badge = p.esFalso ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">FALSO</span>' : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">REAL</span>';
            if(esAdj) badge += ' <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 ml-1">ADJUDICADO</span>';
            return `
            <tr class="hover:bg-gray-50 transition ${esAdj ? 'bg-emerald-50/20' : ''} ${p.esFalso ? 'opacity-40' : ''}">
                <td class="pl-5 py-2 text-[11px] font-bold text-gray-400">${i+1}</td>
                <td class="hidden sm:table-cell py-2 text-[11px] text-gray-500">${window.formatExcelDate(p.fecha)}</td>
                <td class="py-2 font-bold text-[11px] text-gray-900 max-w-[150px] truncate" title="${p.nombre}">${p.nombre}</td>
                <td class="text-right py-2 text-[12px] font-black ${esAdj ? 'text-emerald-600' : 'text-gray-900'}">${formatMoney(p.monto)}</td>
                <td class="text-center pr-5 py-2">${badge}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="p-8 text-center text-gray-400 font-medium">Sin pujas registradas en el excel</td></tr>';
    } catch(e) {}
}

window.filtrarModal = function(tipo) {
    currentFiltroModal = tipo;
    document.getElementById('btn-filtro-todos').className = tipo === 'todos' ? 'px-3 py-1.5 rounded-md bg-black text-white transition' : 'px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:text-black transition';
    document.getElementById('btn-filtro-reales').className = tipo === 'reales' ? 'px-3 py-1.5 rounded-md bg-black text-white transition' : 'px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:text-black transition';
    renderModalTabla();
};

window.cerrarModal = function(e) {
    if(e && e.target.id !== 'modal-pujadores') return;
    document.getElementById('modal-pujadores').classList.add('hidden');
    document.getElementById('modal-pujadores').classList.remove('flex');
};

window.filtrarLotesMain = function() {
    const term = (document.getElementById('search-lotes-main').value || '').toLowerCase();
    const tbody = document.getElementById('dash-tabla-lotes');
    if(!tbody) return;
    const rows = tbody.getElementsByTagName('tr');
    for(let i=0; i<rows.length; i++) {
        const text = rows[i].innerText.toLowerCase();
        rows[i].style.display = text.includes(term) ? '' : 'none';
    }
};

window.sortTable = function(th, type) {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const index = Array.from(th.parentElement.children).indexOf(th);
    const isAsc = th.dataset.asc === 'true' ? false : true;
    th.dataset.asc = isAsc;
    const getValue = (row, idx) => {
        const cell = row.querySelectorAll('td')[idx];
        if (!cell) return '';
        let val = cell.textContent.trim();
        if (type === 'number' || type === 'money') {
            val = parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
        } else if (type === 'percent') {
            val = parseFloat(val.replace('%', '')) || 0;
        }
        return val;
    };
    rows.sort((a, b) => {
        let va = getValue(a, index);
        let vb = getValue(b, index);
        if (typeof va === 'number' && typeof vb === 'number') {
            return isAsc ? va - vb : vb - va;
        }
        return isAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
};