<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { api, type Question, type QuestionInput, type Difficulty } from '$lib/api';

  let sessionReady = false;
  let sessionUser: { email?: string } | null = null;
  let email = '';
  let password = '';
  let busy = false;
  let error = '';
  let notice = '';
  let questions: Question[] = [];
  let total = 0;
  let page = 1;
  let pages = 1;
  let search = '';
  let categoryFilter = '';
  let statusFilter = 'all';
  let editorOpen = false;
  let editingId: string | null = null;
  let saving = false;
  let form: QuestionInput = blankQuestion();

  const difficulties: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: 'Fácil' },
    { value: 'medium', label: 'Intermedia' },
    { value: 'hard', label: 'Difícil' }
  ];

  function blankQuestion(): QuestionInput {
    return {
      question: '',
      options: ['', '', '', ''],
      correctOption: 0,
      explanation: '',
      category: 'IVA',
      difficulty: 'medium',
      source: '',
      active: true
    };
  }

  onMount(() => {
    supabase.auth.getSession().then(({ data }) => {
      sessionUser = data.session?.user ?? null;
      sessionReady = true;

      if (sessionUser) loadQuestions();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionUser = session?.user ?? null;

      if (sessionUser) {
        loadQuestions();
      } else {
        questions = [];
        total = 0;
      }
    });

    return () => listener.subscription.unsubscribe();
  });

  async function signIn() {
    error = '';
    notice = '';
    busy = true;

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authError) throw authError;

      password = '';
    } catch (e) {
      error = e instanceof Error
        ? e.message
        : 'No fue posible iniciar sesión.';
    } finally {
      busy = false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    sessionUser = null;
  }

  async function loadQuestions() {
    error = '';
    busy = true;

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '12',
        status: statusFilter
      });

      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter.trim()) params.set('category', categoryFilter.trim());

      const result = await api<{
        data: Question[];
        meta: { total: number; pages: number };
      }>(`/admin/questions?${params}`);

      questions = result.data;
      total = result.meta.total;
      pages = Math.max(1, result.meta.pages);
    } catch (e) {
      error = e instanceof Error
        ? e.message
        : 'No se pudieron cargar las preguntas.';
    } finally {
      busy = false;
    }
  }

  function newQuestion() {
    editingId = null;
    form = blankQuestion();
    editorOpen = true;
    error = '';
  }

  function editQuestion(q: Question) {
    editingId = q.id;
    form = {
      question: q.question,
      options: [...q.options],
      correctOption: q.correctOption,
      explanation: q.explanation,
      category: q.category,
      difficulty: q.difficulty,
      source: q.source,
      active: q.active
    };
    editorOpen = true;
    error = '';
  }

  async function saveQuestion() {
    error = '';
    notice = '';

    if (
      form.options.some((option) => !option.trim()) ||
      new Set(form.options.map((v) => v.trim().toLocaleLowerCase())).size !== 4
    ) {
      error = 'Completa las cuatro opciones y asegúrate de que sean distintas.';
      return;
    }

    saving = true;

    try {
      const path = editingId
        ? `/admin/questions/${editingId}`
        : '/admin/questions';

      await api(path, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });

      editorOpen = false;
      notice = editingId
        ? 'Pregunta actualizada correctamente.'
        : 'Pregunta creada correctamente.';

      await loadQuestions();
    } catch (e) {
      error = e instanceof Error ? e.message : 'No se pudo guardar.';
    } finally {
      saving = false;
    }
  }

  async function deactivate(q: Question) {
    if (!confirm(`¿Desactivar esta pregunta?\n\n${q.question}`)) return;

    error = '';
    notice = '';

    try {
      await api(`/admin/questions/${q.id}`, { method: 'DELETE' });
      notice = 'Pregunta desactivada.';
      await loadQuestions();
    } catch (e) {
      error = e instanceof Error ? e.message : 'No se pudo desactivar.';
    }
  }

  function difficultyLabel(value: Difficulty) {
    return difficulties.find((d) => d.value === value)?.label ?? value;
  }
</script>

<svelte:head>
  <title>Fiscal Quiz · Admin Console</title>
</svelte:head>

<div class="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
  <header class="mx-auto mb-10 flex max-w-7xl items-center justify-between gap-4">
    <a href="/" class="flex items-center gap-3 no-underline">
      <div class="grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-xl text-violet-200 shadow-glow">
        F<span class="text-cyan-300">/</span>Q
      </div>
      <div>
        <div class="text-xs font-bold uppercase tracking-[.28em] text-cyan-300">
          Fiscal intelligence
        </div>
        <div class="text-lg font-semibold tracking-tight text-white">
          Control Center <span class="text-slate-500">/ v1.0</span>
        </div>
      </div>
    </a>

    {#if sessionUser}
      <div class="flex items-center gap-3">
        <span class="hidden text-sm text-slate-400 sm:inline">{sessionUser.email}</span>
        <button class="btn btn-muted text-sm" onclick={signOut}>
          Cerrar sesión <span aria-hidden="true">↗</span>
        </button>
      </div>
    {/if}
  </header>

  {#if !sessionReady}
    <div class="mx-auto max-w-xl rounded-3xl p-10 text-center glass">
      <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent"></div>
      <p class="text-slate-400">Estableciendo conexión segura…</p>
    </div>
  {:else if !sessionUser}
    <main class="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] glass lg:grid-cols-[1.1fr_.9fr]">
      <section class="relative hidden min-h-[560px] flex-col justify-between overflow-hidden p-12 lg:flex">
        <div class="absolute -left-24 top-12 h-72 w-72 rounded-full bg-violet-600/20 blur-[90px]"></div>
        <div class="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-[90px]"></div>

        <div class="relative">
          <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-200">
            <span class="h-1.5 w-1.5 rounded-full bg-cyan-300"></span>
            Secure workspace
          </div>

          <h1 class="max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight text-white">
            Conocimiento fiscal.<br />
            <span class="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Bajo tu control.
            </span>
          </h1>

          <p class="mt-6 max-w-md leading-7 text-slate-400">
            Administra el banco de preguntas, revisa su contenido y prepara nuevas experiencias de evaluación desde un único centro.
          </p>
        </div>

        <div class="relative grid grid-cols-3 gap-3">
          <div class="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div class="text-xl">⌘</div>
            <div class="mt-2 text-xs text-slate-400">Contenido centralizado</div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div class="text-xl">◈</div>
            <div class="mt-2 text-xs text-slate-400">Acceso restringido</div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div class="text-xl">↗</div>
            <div class="mt-2 text-xs text-slate-400">API independiente</div>
          </div>
        </div>
      </section>

      <section class="flex items-center p-7 sm:p-12">
        <div class="mx-auto w-full max-w-sm">
          <div class="mb-8">
            <div class="text-sm font-semibold text-violet-300">ADMINISTRACIÓN</div>
            <h2 class="mt-2 text-3xl font-semibold tracking-tight text-white">
              Bienvenido de vuelta
            </h2>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              Acceso exclusivo para cuentas autorizadas.
            </p>
          </div>

          <form onsubmit={(e) => { e.preventDefault(); signIn(); }} class="space-y-5">
            <div>
              <label class="label" for="email">Correo electrónico</label>
              <input
                class="field"
                id="email"
                type="email"
                autocomplete="username"
                bind:value={email}
                required
                placeholder="admin@dominio.com"
              />
            </div>

            <div>
              <label class="label" for="password">Contraseña</label>
              <input
                class="field"
                id="password"
                type="password"
                autocomplete="current-password"
                bind:value={password}
                required
                minlength="8"
                placeholder="••••••••••••"
              />
            </div>

            {#if error}
              <p class="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">
                {error}
              </p>
            {/if}

            <button class="btn btn-primary w-full" type="submit" disabled={busy}>
              {busy ? 'Verificando…' : 'Entrar al panel'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p class="mt-6 text-center text-xs leading-5 text-slate-500">
            El registro público está deshabilitado desde esta interfaz. La API también verifica que tu usuario esté autorizado.
          </p>
        </div>
      </section>
    </main>
  {:else}
    <main class="mx-auto max-w-7xl space-y-7">
      <section class="grid gap-4 md:grid-cols-3">
        <div class="rounded-3xl p-6 glass">
          <div class="flex items-center justify-between text-sm text-slate-400">
            <span>Preguntas encontradas</span>
            <span class="text-cyan-300">◉</span>
          </div>
          <div class="mt-3 text-4xl font-semibold tracking-tight text-white">
            {total.toLocaleString('es-MX')}
          </div>
          <div class="mt-2 text-xs text-slate-500">Según filtros actuales</div>
        </div>

        <div class="rounded-3xl p-6 glass">
          <div class="text-sm text-slate-400">Servicio API</div>
          <div class="mt-3 flex items-center gap-2 text-2xl font-semibold text-white">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,.65)]"></span>
            Conectado
          </div>
          <div class="mt-2 text-xs text-slate-500">
            Solicitudes autenticadas con Supabase
          </div>
        </div>

        <div class="rounded-3xl p-6 glass">
          <div class="text-sm text-slate-400">Sesión administrativa</div>
          <div class="mt-3 truncate text-lg font-semibold text-white">{sessionUser.email}</div>
          <div class="mt-2 text-xs text-slate-500">
            Identidad validada por el backend
          </div>
        </div>
      </section>

      <section class="rounded-3xl p-5 sm:p-7 glass">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div class="text-xs font-bold uppercase tracking-[.24em] text-violet-300">
              Question repository
            </div>
            <h1 class="mt-2 text-3xl font-semibold tracking-tight text-white">
              Banco de preguntas
            </h1>
            <p class="mt-2 text-sm text-slate-400">
              Crea, revisa y mantén actualizado el contenido fiscal.
            </p>
          </div>
          <button class="btn btn-primary" onclick={newQuestion}>＋ Nueva pregunta</button>
        </div>

        <div class="mt-7 grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
          <input
            class="field"
            bind:value={search}
            placeholder="Buscar pregunta, categoría o fuente…"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                page = 1;
                loadQuestions();
              }
            }}
          />
          <input
            class="field"
            bind:value={categoryFilter}
            placeholder="Categoría exacta"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                page = 1;
                loadQuestions();
              }
            }}
          />
          <select class="field" bind:value={statusFilter}>
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
          <button class="btn btn-muted" onclick={() => { page = 1; loadQuestions(); }}>
            Filtrar
          </button>
        </div>

        {#if error}
          <div class="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">
            {error}
          </div>
        {/if}

        {#if notice}
          <div class="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200" role="status">
            {notice}
          </div>
        {/if}

        <div class="mt-6 overflow-x-auto">
          <table class="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr class="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th class="px-3 py-3 font-semibold">Pregunta</th>
                <th class="px-3 py-3 font-semibold">Categoría</th>
                <th class="px-3 py-3 font-semibold">Nivel</th>
                <th class="px-3 py-3 font-semibold">Estado</th>
                <th class="px-3 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#if busy}
                <tr>
                  <td colspan="5" class="px-3 py-12 text-center text-slate-400">
                    Cargando banco de preguntas…
                  </td>
                </tr>
              {:else if questions.length === 0}
                <tr>
                  <td colspan="5" class="px-3 py-14 text-center">
                    <div class="text-3xl text-slate-600">⌕</div>
                    <div class="mt-3 font-medium text-slate-300">
                      No hay preguntas para mostrar
                    </div>
                    <p class="mt-1 text-sm text-slate-500">
                      Prueba otros filtros o crea la primera pregunta.
                    </p>
                  </td>
                </tr>
              {:else}
                {#each questions as q (q.id)}
                  <tr class="border-b border-white/[.06] transition hover:bg-white/[.025]">
                    <td class="max-w-md px-3 py-4">
                      <div class="line-clamp-2 font-medium leading-6 text-slate-200">
                        {q.question}
                      </div>
                      <div class="mt-1 text-xs text-slate-500">
                        Actualizada {new Date(q.updatedAt).toLocaleDateString('es-MX')}
                      </div>
                    </td>
                    <td class="px-3 py-4">
                      <span class="rounded-lg border border-violet-300/15 bg-violet-300/[.07] px-2.5 py-1 text-xs text-violet-200">
                        {q.category}
                      </span>
                    </td>
                    <td class="px-3 py-4 text-sm text-slate-400">
                      {difficultyLabel(q.difficulty)}
                    </td>
                    <td class="px-3 py-4">
                      <span class={`inline-flex items-center gap-2 text-xs ${q.active ? 'text-emerald-300' : 'text-slate-500'}`}>
                        <span class={`h-1.5 w-1.5 rounded-full ${q.active ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                        {q.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td class="px-3 py-4">
                      <div class="flex justify-end gap-2">
                        <button class="btn btn-muted !px-3 !py-2 text-xs" onclick={() => editQuestion(q)}>
                          Editar
                        </button>
                        {#if q.active}
                          <button class="btn btn-danger !px-3 !py-2 text-xs" onclick={() => deactivate(q)}>
                            Desactivar
                          </button>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <div class="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white/[.07] pt-5 text-sm text-slate-400 sm:flex-row">
          <span>Página {page} de {pages}</span>
          <div class="flex gap-2">
            <button
              class="btn btn-muted !py-2 text-sm"
              disabled={page <= 1 || busy}
              onclick={() => { page -= 1; loadQuestions(); }}
            >
              ← Anterior
            </button>
            <button
              class="btn btn-muted !py-2 text-sm"
              disabled={page >= pages || busy}
              onclick={() => { page += 1; loadQuestions(); }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </section>
    </main>
  {/if}

  <footer class="mx-auto mt-10 flex max-w-7xl flex-col justify-between gap-2 border-t border-white/[.07] py-5 text-xs text-slate-600 sm:flex-row">
    <span>FISCAL QUIZ PLATFORM · PRIVATE ADMIN CONSOLE</span>
    <span>Autenticación + autorización del lado del servidor</span>
  </footer>
</div>

{#if editorOpen}
  <div
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-8"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) editorOpen = false;
    }}
  >
    <dialog
      open
      class="my-auto w-full max-w-3xl rounded-3xl p-5 sm:p-8 glass"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">
            Question editor
          </div>
          <h2 id="editor-title" class="mt-2 text-2xl font-semibold text-white">
            {editingId ? 'Editar pregunta' : 'Crear pregunta'}
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            La respuesta correcta se conserva en el servidor y no se envía en el endpoint público.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-muted !px-3"
          onclick={() => editorOpen = false}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <form
        class="mt-7 space-y-5"
        onsubmit={(e) => {
          e.preventDefault();
          saveQuestion();
        }}
      >
        <div>
          <label class="label" for="question">Enunciado</label>
          <textarea
            id="question"
            class="field min-h-24 resize-y"
            bind:value={form.question}
            required
            minlength="10"
            maxlength="1000"
            placeholder="Escribe la pregunta fiscal…"
          ></textarea>
        </div>

        <div>
          <div class="label">Opciones de respuesta</div>
          <div class="space-y-3">
            {#each form.options as option, i}
              <div class="flex items-center gap-3">
                <label
                  class={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-bold ${form.correctOption === i ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[.03] text-slate-400'}`}
                >
                  <input
                    class="sr-only"
                    type="radio"
                    name="correctOption"
                    value={i}
                    bind:group={form.correctOption}
                    aria-label={`Marcar opción ${i + 1} como correcta`}
                  />
                  {String.fromCharCode(65 + i)}
                </label>

                <input
                  class="field"
                  bind:value={form.options[i]}
                  required
                  maxlength="300"
                  placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                />

                <button
                  type="button"
                  class={`rounded-lg px-3 py-2 text-xs ${form.correctOption === i ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-slate-500 hover:text-slate-200'}`}
                  onclick={() => form.correctOption = i}
                >
                  {form.correctOption === i ? '✓ Correcta' : 'Marcar correcta'}
                </button>
              </div>
            {/each}
          </div>
        </div>

        <div>
          <label class="label" for="explanation">Explicación</label>
          <textarea
            id="explanation"
            class="field min-h-24 resize-y"
            bind:value={form.explanation}
            required
            minlength="5"
            maxlength="3000"
            placeholder="Explica por qué la respuesta es correcta…"
          ></textarea>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label class="label" for="category">Categoría</label>
            <input
              id="category"
              class="field"
              bind:value={form.category}
              required
              minlength="2"
              maxlength="80"
              placeholder="IVA"
            />
          </div>

          <div>
            <label class="label" for="difficulty">Dificultad</label>
            <select id="difficulty" class="field" bind:value={form.difficulty}>
              {#each difficulties as d}
                <option value={d.value}>{d.label}</option>
              {/each}
            </select>
          </div>

          <div class="flex items-end pb-1">
            <label class="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                class="h-4 w-4 accent-violet-500"
                bind:checked={form.active}
              />
              Pregunta activa
            </label>
          </div>
        </div>

        <div>
          <label class="label" for="source">Fuente / referencia legal</label>
          <textarea
            id="source"
            class="field min-h-20 resize-y"
            bind:value={form.source}
            required
            minlength="3"
            maxlength="1000"
            placeholder="Ley, artículo, URL oficial y fecha de consulta…"
          ></textarea>
        </div>

        {#if error}
          <p class="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        {/if}

        <div class="flex flex-col-reverse justify-end gap-3 border-t border-white/[.08] pt-5 sm:flex-row">
          <button type="button" class="btn btn-muted" onclick={() => editorOpen = false}>
            Cancelar
          </button>
          <button class="btn btn-primary" type="submit" disabled={saving}>
            {saving
              ? 'Guardando…'
              : editingId
                ? 'Guardar cambios'
                : 'Crear pregunta'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </dialog>
  </div>
{/if}


