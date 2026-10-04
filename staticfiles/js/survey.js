(function () {
  'use strict';

  // Scale labels matching wireframe
  var RATING_LABELS = [
    'Far from being achieved',
    'Slightly achieved, needs major intervention',
    'Somewhat achieved, needs minor intervention',
    'Achieved',
    'Exceeded'
  ];

  var ROLE_BASIS_DEFAULTS = {
    'Thesis adviser': 'Thesis',
    'Capstone project mentor': 'Capstone project',
    'Internship host / supervisor': 'Internship',
  };

  var DEGREE_LEVEL_MAP = {
    'UG': 'Undergraduate (UG)',
    'GS': 'Graduate Studies (GS)',
    'SHS': 'Senior High School (SHS)',
  };

  // State
  var state = {
    step: 0,
    fromReview: false,
    college: '',
    department: '',
    degreeLevel: '',
    degreeLevelDisplay: '',
    degreeId: '',
    degreeProgram: '',
    evaluatorName: '',
    roleId: '',
    roleName: '',
    basis: '',
    studentName: '',
    studentNumber: '',
    programYear: '',
    questions: [], // list of question objects
    ratings: {},   // question_id -> 1..5
    notEvaluated: {}, // question_id -> boolean
    reasons: {},   // question_id -> string
    generalComment: '',
    isSubmitting: false,
  };

  // DOM Elements
  var els = {
    collegeSelect: document.getElementById('d-college'),
    deptSelect: document.getElementById('d-dept'),
    levelSelect: document.getElementById('d-level'),
    progSelect: document.getElementById('d-prog'),
    evalNameInput: document.getElementById('d-ename'),
    studNameInput: document.getElementById('d-sname'),
    sidInput: document.getElementById('d-sid'),
    aySelect: document.getElementById('d-ay'),
    commentTextarea: document.getElementById('d-comment'),
    roleButtons: document.querySelectorAll('.role-radio-btn'),
    basisSection: document.getElementById('basis-section'),
    basisButtons: document.querySelectorAll('.basis-radio-btn'),
    studentCardTitle: document.getElementById('student-card-title'),
    studentNameGroup: document.getElementById('student-name-group'),
    idLabel: document.getElementById('id-label'),
    idPartialMsg: document.getElementById('id-partial-msg'),
    ayLabel: document.getElementById('ay-label'),
    ayHelp: document.getElementById('ay-help'),
    btnBack: document.getElementById('btn-back'),
    btnNext: document.getElementById('btn-next'),
    btnSubmit: document.getElementById('btn-submit'),
    footerHint: document.getElementById('footer-hint'),
    stepTitle: document.getElementById('step-title'),
    stepCount: document.getElementById('step-count'),
    progressSegments: document.getElementById('progress-segments'),
    stepDetailsContainer: document.getElementById('step-details'),
    stepQuestionContainer: document.getElementById('step-question'),
    stepReviewContainer: document.getElementById('step-review'),
    reviewDetailsSummary: document.getElementById('review-details-summary'),
    reviewRatingsSummary: document.getElementById('review-ratings-summary'),
    csrfToken: document.querySelector('[name=csrfmiddlewaretoken]') ? document.querySelector('[name=csrfmiddlewaretoken]').value : '',
  };

  // Initialize
  function init() {
    setupCascadingDropdowns();
    setupRoleAndBasis();
    setupInputListeners();
    setupNavigationButtons();

    // Load initial pre-selected degree if passed from backend
    if (window.INITIAL_DEGREE_ID) {
      preselectDegree(window.INITIAL_DEGREE_ID);
    } else {
      populateColleges();
    }

    // Load initial role if passed
    if (window.INITIAL_ROLE_ID) {
      selectRoleById(window.INITIAL_ROLE_ID);
    } else {
      // Default to first role (Thesis adviser)
      var firstRole = document.querySelector('.role-radio-btn');
      if (firstRole) {
        selectRole(firstRole.dataset.roleId, firstRole.dataset.roleName);
      }
    }

    renderUI();
  }

  // --- CASCADING DROPDOWNS ---
  function populateColleges() {
    var hierarchy = window.SURVEY_HIERARCHY || {};
    var colleges = Object.keys(hierarchy).sort();

    els.collegeSelect.innerHTML = '<option value="">Select college</option>';
    colleges.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      els.collegeSelect.appendChild(opt);
    });
  }

  function setupCascadingDropdowns() {
    var hierarchy = window.SURVEY_HIERARCHY || {};

    els.collegeSelect.addEventListener('change', function () {
      state.college = this.value;
      state.department = '';
      state.degreeLevel = '';
      state.degreeLevelDisplay = '';
      state.degreeId = '';
      state.degreeProgram = '';
      state.questions = [];

      els.deptSelect.innerHTML = '<option value="">Select department</option>';
      els.levelSelect.innerHTML = '<option value="">Select a department first</option>';
      els.progSelect.innerHTML = '<option value="">Select a degree level first</option>';

      if (state.college && hierarchy[state.college]) {
        els.deptSelect.disabled = false;
        var depts = Object.keys(hierarchy[state.college]).sort();
        depts.forEach(function (d) {
          var opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          els.deptSelect.appendChild(opt);
        });
      } else {
        els.deptSelect.disabled = true;
      }
      els.levelSelect.disabled = true;
      els.progSelect.disabled = true;
      renderUI();
    });

    els.deptSelect.addEventListener('change', function () {
      state.department = this.value;
      state.degreeLevel = '';
      state.degreeLevelDisplay = '';
      state.degreeId = '';
      state.degreeProgram = '';
      state.questions = [];

      els.levelSelect.innerHTML = '<option value="">Select degree level</option>';
      els.progSelect.innerHTML = '<option value="">Select degree program</option>';

      if (state.college && state.department && hierarchy[state.college][state.department]) {
        els.levelSelect.disabled = false;
        var progs = hierarchy[state.college][state.department];

        // Collect unique levels in this department
        var levels = [];
        progs.forEach(function (p) {
          if (p.degree_level && levels.indexOf(p.degree_level) === -1) {
            levels.push(p.degree_level);
          }
        });
        levels.sort();

        if (levels.length > 1) {
          var allOpt = document.createElement('option');
          allOpt.value = 'ALL';
          allOpt.textContent = 'All degree levels';
          els.levelSelect.appendChild(allOpt);
        }

        levels.forEach(function (lvl) {
          var opt = document.createElement('option');
          opt.value = lvl;
          opt.textContent = DEGREE_LEVEL_MAP[lvl] || lvl;
          els.levelSelect.appendChild(opt);
        });

        // If only 1 level exists, auto-select it
        if (levels.length === 1) {
          els.levelSelect.value = levels[0];
          state.degreeLevel = levels[0];
          state.degreeLevelDisplay = DEGREE_LEVEL_MAP[levels[0]] || levels[0];
        }

        populateProgramsForCurrentDeptAndLevel();
      } else {
        els.levelSelect.disabled = true;
        els.progSelect.disabled = true;
      }
      renderUI();
    });

    els.levelSelect.addEventListener('change', function () {
      state.degreeLevel = this.value;
      state.degreeLevelDisplay = this.value && this.value !== 'ALL'
        ? (DEGREE_LEVEL_MAP[this.value] || this.value)
        : (this.value === 'ALL' ? 'All degree levels' : '');
      populateProgramsForCurrentDeptAndLevel();
    });

    els.progSelect.addEventListener('change', function () {
      state.degreeId = this.value;
      var selOpt = this.options[this.selectedIndex];
      state.degreeProgram = selOpt ? selOpt.textContent : '';

      if (state.degreeId) {
        var hierarchy = window.SURVEY_HIERARCHY || {};
        var progs = (hierarchy[state.college] && hierarchy[state.college][state.department]) || [];
        var p = progs.find(function (item) { return item.degree_id == state.degreeId; });
        if (p) {
          state.degreeProgram = p.degree_program;
          state.degreeLevel = p.degree_level;
          state.degreeLevelDisplay = DEGREE_LEVEL_MAP[p.degree_level] || p.degree_level;
          els.levelSelect.value = p.degree_level;
        }
        fetchQuestionsForDegree(state.degreeId);
      } else {
        state.questions = [];
        renderUI();
      }
    });
  }

  function populateProgramsForCurrentDeptAndLevel() {
    var hierarchy = window.SURVEY_HIERARCHY || {};
    if (!state.college || !state.department || !hierarchy[state.college] || !hierarchy[state.college][state.department]) {
      els.progSelect.disabled = true;
      els.progSelect.innerHTML = '<option value="">Select a department first</option>';
      return;
    }

    var progs = hierarchy[state.college][state.department];
    var filtered = progs;
    if (state.degreeLevel && state.degreeLevel !== 'ALL') {
      filtered = progs.filter(function (p) { return p.degree_level === state.degreeLevel; });
    }

    els.progSelect.disabled = false;
    els.progSelect.innerHTML = '<option value="">Select degree program</option>';
    filtered.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.degree_id;
      opt.dataset.level = p.degree_level;
      var suffix = (state.degreeLevel === 'ALL' || !state.degreeLevel) ? ' (' + p.degree_level + ')' : '';
      opt.textContent = p.degree_program + suffix;
      opt.title = p.degree_program + suffix;
      els.progSelect.appendChild(opt);
    });

    if (state.degreeId && !filtered.some(function (p) { return p.degree_id == state.degreeId; })) {
      state.degreeId = '';
      state.degreeProgram = '';
      state.questions = [];
    } else if (state.degreeId) {
      els.progSelect.value = state.degreeId;
    }
    renderUI();
  }

  function preselectDegree(degreeId) {
    var hierarchy = window.SURVEY_HIERARCHY || {};
    populateColleges();

    // Search hierarchy for degreeId
    for (var col in hierarchy) {
      for (var dept in hierarchy[col]) {
        var progs = hierarchy[col][dept];
        for (var i = 0; i < progs.length; i++) {
          if (progs[i].degree_id == degreeId) {
            state.college = col;
            state.department = dept;
            state.degreeLevel = progs[i].degree_level;
            state.degreeLevelDisplay = DEGREE_LEVEL_MAP[progs[i].degree_level] || progs[i].degree_level;
            state.degreeId = degreeId;
            state.degreeProgram = progs[i].degree_program;

            els.collegeSelect.value = col;
            els.deptSelect.disabled = false;
            els.deptSelect.innerHTML = '<option value="">Select department</option>';
            Object.keys(hierarchy[col]).sort().forEach(function (d) {
              var opt = document.createElement('option');
              opt.value = d;
              opt.textContent = d;
              els.deptSelect.appendChild(opt);
            });
            els.deptSelect.value = dept;

            // Populate levels
            els.levelSelect.disabled = false;
            els.levelSelect.innerHTML = '<option value="">Select degree level</option>';
            var levels = [];
            progs.forEach(function (p) {
              if (p.degree_level && levels.indexOf(p.degree_level) === -1) {
                levels.push(p.degree_level);
              }
            });
            levels.sort();
            if (levels.length > 1) {
              var allOpt = document.createElement('option');
              allOpt.value = 'ALL';
              allOpt.textContent = 'All degree levels';
              els.levelSelect.appendChild(allOpt);
            }
            levels.forEach(function (lvl) {
              var opt = document.createElement('option');
              opt.value = lvl;
              opt.textContent = DEGREE_LEVEL_MAP[lvl] || lvl;
              els.levelSelect.appendChild(opt);
            });
            els.levelSelect.value = progs[i].degree_level;

            // Populate programs
            els.progSelect.disabled = false;
            els.progSelect.innerHTML = '<option value="">Select degree program</option>';
            progs.forEach(function (p) {
              var opt = document.createElement('option');
              opt.value = p.degree_id;
              opt.textContent = p.degree_program;
              els.progSelect.appendChild(opt);
            });
            els.progSelect.value = degreeId;

            // Load questions
            if (window.INITIAL_QUESTIONS && window.INITIAL_QUESTIONS.length > 0) {
              state.questions = window.INITIAL_QUESTIONS;
              renderUI();
            } else {
              fetchQuestionsForDegree(degreeId);
            }
            return;
          }
        }
      }
    }
  }

  function fetchQuestionsForDegree(degreeId) {
    fetch('/api/questions/?degree_id=' + encodeURIComponent(degreeId))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.questions = data.questions || [];
        renderUI();
      })
      .catch(function (err) {
        console.error('Error fetching questions:', err);
        renderUI();
      });
  }

  // --- ROLE AND BASIS HANDLING ---
  function setupRoleAndBasis() {
    els.roleButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectRole(this.dataset.roleId, this.dataset.roleName);
      });
    });

    els.basisButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectBasis(this.dataset.basis);
      });
    });
  }

  function selectRoleById(roleId) {
    var btn = document.querySelector('.role-radio-btn[data-role-id="' + roleId + '"]');
    if (btn) {
      selectRole(btn.dataset.roleId, btn.dataset.roleName);
    }
  }

  function selectRole(roleId, roleName) {
    state.roleId = roleId;
    state.roleName = roleName;

    els.roleButtons.forEach(function (b) {
      var sel = b.dataset.roleId === roleId;
      b.classList.toggle('selected', sel);
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
      var dot = b.querySelector('.radio-dot');
      if (dot) dot.style.display = sel ? 'block' : 'none';
    });

    var isStudent = roleName === 'Student (rating myself)';
    if (isStudent) {
      els.basisSection.style.display = 'none';
      els.studentNameGroup.style.display = 'none';
      els.studentCardTitle.textContent = 'Your program details';
      els.idLabel.textContent = 'Your student ID number';
      els.ayLabel.textContent = 'Academic year you started your current program';
      els.ayHelp.textContent = 'If you shifted programs, choose the year you started this one.';
      state.basis = '';
    } else {
      els.basisSection.style.display = 'flex';
      els.studentNameGroup.style.display = 'flex';
      els.studentCardTitle.textContent = 'About the student';
      els.idLabel.textContent = 'Student’s ID number';
      els.ayLabel.textContent = 'Academic year the student started their current program';
      els.ayHelp.textContent = 'If the student shifted programs, choose the year they started this one.';

      // Set default basis from role
      var defBasis = ROLE_BASIS_DEFAULTS[roleName] || 'Thesis';
      selectBasis(defBasis);
    }
    renderUI();
  }

  function selectBasis(basisName) {
    state.basis = basisName;
    els.basisButtons.forEach(function (b) {
      var sel = b.dataset.basis === basisName;
      b.classList.toggle('selected', sel);
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
      var dot = b.querySelector('.radio-dot');
      if (dot) dot.style.display = sel ? 'block' : 'none';
    });
    renderUI();
  }

  // --- INPUT LISTENERS ---
  function setupInputListeners() {
    els.evalNameInput.addEventListener('input', function () {
      state.evaluatorName = this.value;
      renderUI();
    });

    els.studNameInput.addEventListener('input', function () {
      state.studentName = this.value;
      renderUI();
    });

    els.sidInput.addEventListener('input', function () {
      // allow only digits, max 8
      this.value = this.value.replace(/\D/g, '').slice(0, 8);
      state.studentNumber = this.value;
      renderUI();
    });

    els.aySelect.addEventListener('change', function () {
      state.programYear = this.value;
      renderUI();
    });

    els.commentTextarea.addEventListener('input', function () {
      state.generalComment = this.value;
    });
  }

  // --- VALIDATION HELPERS ---
  function isStudentIdValid(id) {
    return /^\d{8}$/.test(id);
  }

  function isStep0Valid() {
    var missing = [];
    if (!state.degreeId) missing.push('degree program');
    if (!state.evaluatorName.trim()) missing.push('your name');
    if (!state.roleId) missing.push('your role');

    var isStudent = state.roleName === 'Student (rating myself)';
    if (!isStudent) {
      if (!state.studentName.trim()) missing.push('student’s name');
      if (!state.basis) missing.push('basis');
    }

    if (!isStudentIdValid(state.studentNumber)) {
      missing.push('8-digit ID number');
    }

    if (!state.programYear) missing.push('year started');

    return {
      valid: missing.length === 0,
      missing: missing,
    };
  }

  function isQuestionStepValid(qIndex) {
    var q = state.questions[qIndex];
    if (!q) return false;

    var qId = q.question_id;
    var isNE = !!state.notEvaluated[qId];
    var rating = state.ratings[qId];
    var reason = (state.reasons[qId] || '').trim();

    if (!isNE && !rating) {
      return { valid: false, reasonNeeded: false, prompt: 'Choose a rating to continue' };
    }

    var needsReason = isNE || (rating && rating < 4);
    if (needsReason && !reason) {
      return {
        valid: false,
        reasonNeeded: true,
        prompt: isNE ? 'Add explanation why you cannot evaluate this outcome' : 'Add a short reason for this rating to continue'
      };
    }

    return { valid: true, reasonNeeded: false, prompt: '' };
  }

  // --- NAVIGATION & RENDERING ---
  function setupNavigationButtons() {
    els.btnNext.addEventListener('click', function () {
      handleNext();
    });

    els.btnBack.addEventListener('click', function () {
      handleBack();
    });

    els.btnSubmit.addEventListener('click', function () {
      handleSubmit();
    });
  }

  function handleNext() {
    var totalQuestions = state.questions.length;
    var reviewStepIndex = totalQuestions + 1;

    if (state.fromReview) {
      // Return directly to review
      state.step = reviewStepIndex;
      state.fromReview = false;
      renderUI();
      return;
    }

    if (state.step === 0) {
      var v0 = isStep0Valid();
      if (!v0.valid) return;
      state.step = 1;
    } else if (state.step >= 1 && state.step <= totalQuestions) {
      var vQ = isQuestionStepValid(state.step - 1);
      if (!vQ.valid) return;
      state.step++;
    }
    renderUI();
  }

  function handleBack() {
    if (state.step > 0) {
      state.step--;
      renderUI();
    }
  }

  function jumpToStep(targetStep) {
    state.step = targetStep;
    state.fromReview = true;
    renderUI();
  }

  function renderUI() {
    var totalQuestions = state.questions.length;
    var reviewStepIndex = totalQuestions + 1;
    var totalSteps = totalQuestions + 2; // Details + N Questions + Review

    // Scroll to top of content smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 1. Visibility of step containers
    els.stepDetailsContainer.style.display = (state.step === 0) ? 'flex' : 'none';
    els.stepQuestionContainer.style.display = (state.step >= 1 && state.step <= totalQuestions) ? 'flex' : 'none';
    els.stepReviewContainer.style.display = (state.step === reviewStepIndex) ? 'flex' : 'none';

    // 2. ID validation feedback
    if (state.studentNumber.length > 0 && !isStudentIdValid(state.studentNumber)) {
      els.sidInput.classList.add('input-error');
      els.idPartialMsg.style.display = 'block';
    } else {
      els.sidInput.classList.remove('input-error');
      els.idPartialMsg.style.display = 'none';
    }

    // 3. Step Title & Progress Bar
    var currentStepDisplayNumber = state.step + 1;
    els.stepCount.textContent = 'Step ' + currentStepDisplayNumber + ' of ' + totalSteps;

    if (state.step === 0) {
      els.stepTitle.textContent = 'Your details';
    } else if (state.step >= 1 && state.step <= totalQuestions) {
      els.stepTitle.textContent = 'Outcome ' + state.step + ' of ' + totalQuestions;
    } else {
      els.stepTitle.textContent = 'Review';
    }

    // Segments
    els.progressSegments.innerHTML = '';
    for (var s = 0; s < totalSteps; s++) {
      var seg = document.createElement('div');
      seg.className = 'progress-segment' + (s <= state.step ? ' active' : '');
      els.progressSegments.appendChild(seg);
    }

    // 4. Render Step Specific Content
    if (state.step >= 1 && state.step <= totalQuestions) {
      renderQuestionStep(state.step - 1);
    } else if (state.step === reviewStepIndex) {
      renderReviewStep();
    }

    // 5. Footer Buttons & Hints
    updateFooter(totalQuestions, reviewStepIndex);
  }

  function renderQuestionStep(qIndex) {
    var q = state.questions[qIndex];
    if (!q) return;

    var qId = q.question_id;
    var currentRating = state.ratings[qId] || null;
    var isNE = !!state.notEvaluated[qId];
    var currentReason = state.reasons[qId] || '';

    var container = els.stepQuestionContainer;
    container.innerHTML = '';

    // Card element
    // Card element
    var card = document.createElement('section');
    card.className = 'card question-card';
    card.setAttribute('role', 'radiogroup');
    card.setAttribute('aria-label', 'Outcome ' + (qIndex + 1) + ' rating');

    // Left Column: Question Context & Details
    var header = document.createElement('div');
    header.className = 'question-header';

    var headerTop = document.createElement('div');
    headerTop.className = 'question-header-top';

    var numBadge = document.createElement('span');
    numBadge.className = 'outcome-number-badge';
    numBadge.textContent = (qIndex + 1);
    headerTop.appendChild(numBadge);

    var stepIndicator = document.createElement('span');
    stepIndicator.className = 'outcome-step-text';
    stepIndicator.textContent = 'Outcome ' + (qIndex + 1) + ' of ' + state.questions.length;
    headerTop.appendChild(stepIndicator);

    header.appendChild(headerTop);

    var meta = document.createElement('div');
    meta.className = 'question-meta';

    // PLO Tags
    var tagsWrap = document.createElement('div');
    tagsWrap.className = 'plo-tags-container';

    var ploCodes = q.plo_codes || [];
    if (ploCodes.length > 0) {
      ploCodes.forEach(function (code) {
        var tag = document.createElement('span');
        tag.className = 'plo-tag';
        tag.textContent = code;
        tagsWrap.appendChild(tag);
      });
      if (ploCodes.length > 1) {
        var multiNotice = document.createElement('span');
        multiNotice.className = 'multi-plo-notice';
        multiNotice.textContent = '(Measures multiple PLOs)';
        tagsWrap.appendChild(multiNotice);
      }
    }
    meta.appendChild(tagsWrap);

    // Question statement
    var qText = document.createElement('p');
    qText.className = 'question-text';
    qText.textContent = q.question_text;
    meta.appendChild(qText);

    // Desktop guidance note
    var guideBox = document.createElement('div');
    guideBox.className = 'question-guide-box';
    guideBox.innerHTML = '<span class="guide-title">Assessment Guidance</span>' +
      '<p class="guide-text">Evaluate the student’s demonstrated proficiency for this outcome using the 1–5 rating options.</p>';
    meta.appendChild(guideBox);

    header.appendChild(meta);
    card.appendChild(header);

    // Right Column: Evaluation Options & Justification
    var evalCol = document.createElement('div');
    evalCol.className = 'question-eval-col';

    var evalHeader = document.createElement('div');
    evalHeader.className = 'eval-header';
    evalHeader.innerHTML = '<h3 class="eval-title">Select Performance Rating</h3>' +
      '<span class="eval-subtitle">Rate from 1 (Strongly Disagree) to 5 (Strongly Agree)</span>';
    evalCol.appendChild(evalHeader);

    // Ratings group
    var ratingGroup = document.createElement('div');
    ratingGroup.className = 'rating-group';

    // 1 to 5 options
    for (var r = 1; r <= 5; r++) {
      (function (score) {
        var isSel = (currentRating === score && !isNE);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rating-button' + (isSel ? ' selected' : '');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', isSel ? 'true' : 'false');

        btn.innerHTML =
          '<span class="radio-indicator">' +
            (isSel ? '<span class="radio-dot"></span>' : '') +
          '</span>' +
          '<span class="rating-score">' + score + '</span>' +
          '<span class="rating-desc">' + RATING_LABELS[score - 1] + '</span>';

        btn.addEventListener('click', function () {
          state.ratings[qId] = score;
          state.notEvaluated[qId] = false;
          renderUI();
        });

        ratingGroup.appendChild(btn);
      })(r);
    }

    // Divider
    var div = document.createElement('div');
    div.className = 'divider';
    ratingGroup.appendChild(div);

    // "Not enough info / experience" option
    var neBtn = document.createElement('button');
    neBtn.type = 'button';
    neBtn.className = 'rating-button' + (isNE ? ' selected' : '');
    neBtn.setAttribute('role', 'radio');
    neBtn.setAttribute('aria-checked', isNE ? 'true' : 'false');
    neBtn.style.color = '#5F6B65';

    neBtn.innerHTML =
      '<span class="radio-indicator">' +
        (isNE ? '<span class="radio-dot"></span>' : '') +
      '</span>' +
      '<span class="rating-desc">Not enough info / experience to evaluate</span>';

    neBtn.addEventListener('click', function () {
      state.notEvaluated[qId] = true;
      state.ratings[qId] = null;
      renderUI();
    });
    ratingGroup.appendChild(neBtn);

    evalCol.appendChild(ratingGroup);

    // Conditional reason box
    var needsReason = isNE || (currentRating && currentRating < 4);
    if (needsReason) {
      var reasonBox = document.createElement('div');
      reasonBox.className = 'reason-box';

      var label = document.createElement('label');
      label.className = 'form-label';
      label.setAttribute('for', 'q-reason-' + qId);
      label.textContent = isNE
        ? 'Why can’t you evaluate this outcome? (required)'
        : 'Why this rating? (required)';
      reasonBox.appendChild(label);

      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'q-reason-' + qId;
      input.className = 'form-input' + (!currentReason.trim() ? ' input-error' : '');
      input.maxLength = 300;
      input.placeholder = isNE ? 'e.g. Student was not assigned to this module' : 'Briefly explain the rating';
      input.value = currentReason;

      input.addEventListener('input', function () {
        state.reasons[qId] = this.value;
        if (this.value.trim()) {
          this.classList.remove('input-error');
        } else {
          this.classList.add('input-error');
        }
        updateFooter(state.questions.length, state.questions.length + 1);
      });

      reasonBox.appendChild(input);
      evalCol.appendChild(reasonBox);
    }

    card.appendChild(evalCol);
    container.appendChild(card);
  }

  function renderReviewStep() {
    // 1. Details summary
    var isStudent = state.roleName === 'Student (rating myself)';
    var rowsHtml = '';
    if (state.degreeLevelDisplay) {
      rowsHtml += '<div class="review-row"><span class="review-row-label">Degree level</span><span class="review-row-value">' + escapeHtml(state.degreeLevelDisplay) + '</span></div>';
    }
    rowsHtml += '<div class="review-row"><span class="review-row-label">Degree program</span><span class="review-row-value">' + escapeHtml(state.degreeProgram) + '</span></div>';
    rowsHtml += '<div class="review-row"><span class="review-row-label">Your name</span><span class="review-row-value">' + escapeHtml(state.evaluatorName) + '</span></div>';
    rowsHtml += '<div class="review-row"><span class="review-row-label">Role</span><span class="review-row-value">' + escapeHtml(state.roleName) + '</span></div>';
    if (!isStudent) {
      rowsHtml += '<div class="review-row"><span class="review-row-label">Basis</span><span class="review-row-value">' + escapeHtml(state.basis || '—') + '</span></div>';
      rowsHtml += '<div class="review-row"><span class="review-row-label">Student</span><span class="review-row-value">' + escapeHtml(state.studentName) + '</span></div>';
    }
    rowsHtml += '<div class="review-row"><span class="review-row-label">Student ID</span><span class="review-row-value">' + escapeHtml(state.studentNumber) + '</span></div>';
    rowsHtml += '<div class="review-row"><span class="review-row-label">Year started</span><span class="review-row-value">' + escapeHtml(state.programYear) + '</span></div>';
    els.reviewDetailsSummary.innerHTML = rowsHtml;

    // Attach Edit Details button
    var editDetailsBtn = document.getElementById('btn-edit-details');
    if (editDetailsBtn) {
      editDetailsBtn.onclick = function () {
        jumpToStep(0);
      };
    }

    // 2. Ratings summary
    els.reviewRatingsSummary.innerHTML = '';
    state.questions.forEach(function (q, idx) {
      var qId = q.question_id;
      var isNE = !!state.notEvaluated[qId];
      var r = state.ratings[qId];
      var reason = (state.reasons[qId] || '').trim();

      var summaryText = 'Not answered';
      var badgeClass = 'badge-rating-default';
      if (isNE) {
        summaryText = 'Not evaluated';
        badgeClass = 'badge-rating-ne';
      } else if (r) {
        summaryText = r + ' · ' + RATING_LABELS[r - 1];
        badgeClass = 'badge-rating-' + r;
      }

      var item = document.createElement('div');
      item.className = 'review-rating-item';

      var badge = document.createElement('span');
      badge.className = 'rating-small-badge';
      badge.textContent = (idx + 1);
      item.appendChild(badge);

      var info = document.createElement('div');
      info.className = 'rating-item-info';

      // Question title & PLO badges
      var qHeader = document.createElement('div');
      qHeader.className = 'review-item-header';

      var plosHtml = '';
      if (q.plo_codes && q.plo_codes.length > 0) {
        q.plo_codes.forEach(function (code) {
          plosHtml += '<span class="plo-tag" style="font-size: 11px; padding: 1px 6px;">' + escapeHtml(code) + '</span> ';
        });
      }
      qHeader.innerHTML = plosHtml;
      info.appendChild(qHeader);

      // Question full text
      var qTextEl = document.createElement('div');
      qTextEl.className = 'review-item-qtext';
      qTextEl.textContent = q.question_text;
      info.appendChild(qTextEl);

      // Rating pill
      var ratingPill = document.createElement('div');
      ratingPill.className = 'review-item-rating-pill ' + badgeClass;
      ratingPill.textContent = summaryText;
      info.appendChild(ratingPill);

      if (reason) {
        var reasonSpan = document.createElement('div');
        reasonSpan.className = 'rating-item-reason';
        reasonSpan.textContent = 'Reason: “' + reason + '”';
        info.appendChild(reasonSpan);
      }
      item.appendChild(info);

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-edit';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('aria-label', 'Edit outcome ' + (idx + 1));
      editBtn.addEventListener('click', function () {
        jumpToStep(idx + 1);
      });
      item.appendChild(editBtn);

      els.reviewRatingsSummary.appendChild(item);
    });
  }

  function updateFooter(totalQuestions, reviewStepIndex) {
    var isReview = (state.step === reviewStepIndex);
    var isBackVisible = (state.step > 0 && !state.fromReview);

    els.btnBack.style.display = isBackVisible ? 'block' : 'none';
    els.btnSubmit.style.display = isReview ? 'flex' : 'none';
    els.btnNext.style.display = !isReview ? 'flex' : 'none';

    if (state.fromReview) {
      els.btnNext.textContent = 'Back to review';
      els.btnNext.disabled = false;
      els.footerHint.textContent = '';
      return;
    }

    if (state.step === 0) {
      var v0 = isStep0Valid();
      els.btnNext.textContent = 'Start rating';
      els.btnNext.disabled = !v0.valid;
      els.footerHint.textContent = v0.valid
        ? ''
        : 'Still needed: ' + v0.missing.join(', ');
    } else if (state.step >= 1 && state.step <= totalQuestions) {
      var vQ = isQuestionStepValid(state.step - 1);
      var isLast = (state.step === totalQuestions);
      els.btnNext.textContent = isLast ? 'Review answers' : 'Next';
      els.btnNext.disabled = !vQ.valid;
      els.footerHint.textContent = vQ.valid ? '' : vQ.prompt;
    } else {
      els.footerHint.textContent = '';
    }
  }

  // --- SUBMISSION ---
  function handleSubmit() {
    if (state.isSubmitting) return;

    // Validate all answers complete
    for (var i = 0; i < state.questions.length; i++) {
      var v = isQuestionStepValid(i);
      if (!v.valid) {
        alert('Please complete Outcome ' + (i + 1) + ' before submitting.');
        jumpToStep(i + 1);
        return;
      }
    }

    state.isSubmitting = true;
    els.btnSubmit.disabled = true;
    els.btnSubmit.innerHTML = '<span class="spinner"></span> Submitting...';

    var payload = {
      degree_id: state.degreeId,
      role_id: state.roleId,
      evaluator_name: state.evaluatorName,
      basis: state.basis,
      student_name: state.studentName,
      student_number: state.studentNumber,
      program_year: state.programYear,
      general_comment: state.generalComment,
      answers: {},
      reasons: state.reasons,
    };

    state.questions.forEach(function (q) {
      var qId = q.question_id;
      if (state.notEvaluated[qId]) {
        payload.answers[qId] = 0; // 0 represents "Not enough info/experience"
      } else {
        payload.answers[qId] = state.ratings[qId] || null;
      }
    });

    fetch('/submit/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': els.csrfToken,
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          window.location.href = result.data.redirect_url;
        } else {
          alert('Submission error: ' + (result.data.error || 'Failed to submit. Please try again.'));
          state.isSubmitting = false;
          els.btnSubmit.disabled = false;
          els.btnSubmit.textContent = 'Confirm & submit';
        }
      })
      .catch(function (err) {
        console.error('Submission error:', err);
        alert('A network error occurred. Please check your connection and try again.');
        state.isSubmitting = false;
        els.btnSubmit.disabled = false;
        els.btnSubmit.textContent = 'Confirm & submit';
      });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // DOM ready trigger
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
