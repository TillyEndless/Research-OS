function escapeHtml(value) {

  return String(
    value ?? "",
  )
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    );
}


function renderEmpty() {

  return `
    <p class="empty">
      None
    </p>
  `;
}


function entityCard(entity) {

  if (!entity) {
    return "";
  }


  const summary =
    entity.summary
    ?? entity.statement
    ?? entity.question
    ?? entity.task
    ?? "";


  return `
    <article class="card">

      <div class="entity-header">

        <code>
          ${escapeHtml(
            entity.id,
          )}
        </code>

        <span class="status">
          ${escapeHtml(
            entity.status,
          )}
        </span>

      </div>


      <h3>
        ${escapeHtml(
          entity.title,
        )}
      </h3>


      <div class="entity-type">
        ${escapeHtml(
          entity.type,
        )}
      </div>


      ${
        summary
          ? `
            <p class="summary">
              ${escapeHtml(summary)}
            </p>
          `
          : ""
      }

    </article>
  `;
}


function renderEntityList(
  elementId,
  entities,
) {

  const element =
    document.getElementById(
      elementId,
    );


  if (!element) {
    return;
  }


  if (
    !Array.isArray(entities)
    ||
    entities.length === 0
  ) {

    element.innerHTML =
      renderEmpty();

    return;
  }


  element.innerHTML =
    entities
      .map(
        entityCard,
      )
      .join("");
}


function normalizeContradictions(
  workspace,
) {

  const value =
    workspace?.major_contradictions
    ?? workspace?.majorContradictions
    ?? [];


  return Array.isArray(value)
    ? value
    : [];
}


function normalizeBlockers(
  workspace,
) {

  const value =
    workspace?.blockers
    ?? [];


  return Array.isArray(value)
    ? value
    : [];
}


function renderWorkspace(
  workspace,
) {

  const element =
    document.getElementById(
      "workspace",
    );


  if (!element) {
    return;
  }


  if (!workspace) {

    element.innerHTML =
      renderEmpty();

    return;
  }


  const contradictions =
    normalizeContradictions(
      workspace,
    );


  const blockers =
    normalizeBlockers(
      workspace,
    );


  element.innerHTML = `

    <article class="panel">

      <div class="panel-label">
        Core Question
      </div>

      <p class="large-text">
        ${escapeHtml(
          workspace.core_question
          ?? workspace.coreQuestion,
        )}
      </p>

    </article>


    <article class="panel">

      <div class="panel-label">
        Current Summary
      </div>

      <p>
        ${escapeHtml(
          workspace.current_summary
          ?? workspace.currentSummary,
        )}
      </p>

    </article>


    <article class="panel">

      <div class="panel-label">
        Major Contradictions
      </div>

      ${
        contradictions.length
          ? contradictions
              .map(
                item => `

                  <div class="contradiction">

                    <strong>
                      ${escapeHtml(
                        item.title,
                      )}
                    </strong>

                    <p>
                      ${escapeHtml(
                        item.description,
                      )}
                    </p>

                    ${
                      item.status
                        ? `
                          <span class="mini-status">
                            ${escapeHtml(
                              item.status,
                            )}
                          </span>
                        `
                        : ""
                    }

                  </div>

                `,
              )
              .join("")

          : renderEmpty()
      }

    </article>


    <article class="panel">

      <div class="panel-label">
        Blockers
      </div>

      ${
        blockers.length
          ? `
            <ul>
              ${
                blockers
                  .map(
                    blocker => `
                      <li>
                        ${escapeHtml(
                          blocker,
                        )}
                      </li>
                    `,
                  )
                  .join("")
              }
            </ul>
          `
          : renderEmpty()
      }

    </article>
  `;
}


function renderRoadmap(
  roadmap,
) {

  const nodes =
    roadmap?.nodes
    ?? [];


  const edges =
    roadmap?.edges
    ?? roadmap?.relations
    ?? [];


  renderEntityList(
    "roadmap-nodes",
    nodes,
  );


  const edgeElement =
    document.getElementById(
      "roadmap-edges",
    );


  if (!edgeElement) {
    return;
  }


  if (
    !Array.isArray(edges)
    ||
    edges.length === 0
  ) {

    edgeElement.innerHTML =
      renderEmpty();

    return;
  }


  edgeElement.innerHTML =
    edges
      .map(
        edge => {

          const source =
            edge.source_entity_id
            ?? edge.source
            ?? edge.source_id;


          const relation =
            edge.relation_type
            ?? edge.type;


          const target =
            edge.target_entity_id
            ?? edge.target
            ?? edge.target_id;


          return `
            <div class="edge">

              <code>
                ${escapeHtml(source)}
              </code>

              <span class="relation">
                ${escapeHtml(relation)}
              </span>

              <code>
                ${escapeHtml(target)}
              </code>

            </div>
          `;
        },
      )
      .join("");
}


function renderCounts(
  counts,
) {

  const element =
    document.getElementById(
      "counts",
    );


  if (!element) {
    return;
  }


  if (
    !counts
    ||
    Object.keys(counts).length === 0
  ) {

    element.innerHTML =
      renderEmpty();

    return;
  }


  element.innerHTML =
    Object
      .entries(counts)
      .map(
        (
          [
            type,
            count,
          ],
        ) => `

          <article class="stat">

            <strong>
              ${escapeHtml(count)}
            </strong>

            <span>
              ${escapeHtml(type)}
            </span>

          </article>

        `,
      )
      .join("");
}


async function loadDashboard() {

  const refreshButton =
    document.getElementById(
      "refresh",
    );


  if (refreshButton) {
    refreshButton.disabled =
      true;
  }


  try {

    const response =
      await fetch(
        "/api/dashboard",
      );


    if (!response.ok) {

      throw new Error(
        `Dashboard request failed: HTTP ${response.status}`,
      );
    }


    const data =
      await response.json();


    renderWorkspace(
      data.workspace,
    );


    renderEntityList(
      "hypotheses",
      data.active_hypotheses
      ?? data.activeHypotheses
      ?? [],
    );


    renderEntityList(
      "experiments",
      data.active_experiments
      ?? data.activeExperiments
      ?? [],
    );


    renderEntityList(
      "actions",
      data.planned_actions
      ?? data.plannedActions
      ?? [],
    );


    renderEntityList(
      "findings",
      data.recent_findings
      ?? data.recentFindings
      ?? [],
    );


    renderEntityList(
      "decisions",
      data.recent_decisions
      ?? data.recentDecisions
      ?? [],
    );


    renderRoadmap(
      data.roadmap
      ?? {},
    );


    renderCounts(
      data.counts
      ?? data.stats
      ?? {},
    );


  } finally {

    if (refreshButton) {
      refreshButton.disabled =
        false;
    }
  }
}


document
  .getElementById(
    "refresh",
  )
  ?.addEventListener(
    "click",
    () => {

      loadDashboard()
        .catch(
          showError,
        );
    },
  );


function showError(
  error,
) {

  console.error(
    error,
  );


  const existing =
    document.getElementById(
      "dashboard-error",
    );


  if (existing) {
    existing.remove();
  }


  const element =
    document.createElement(
      "pre",
    );


  element.id =
    "dashboard-error";


  element.className =
    "error";


  element.textContent =
    error instanceof Error
      ? error.message
      : String(error);


  document.body.appendChild(
    element,
  );
}


loadDashboard()
  .catch(
    showError,
  );
