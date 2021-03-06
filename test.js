var jzaTools = require('./index');

var assert = require('assert');
var _ = require('underscore');

var analysisShouldBeWithJza = function (jza, symbols, expected) {
  var analysis = _.chain(jza.analyze(symbols))
    .map(function (result) {
      return _.pluck(result, 'name').toString();
    })
    .uniq()
    .value();

  if (expected.length) assert(jza.validate(symbols));

  assert.equal(analysis.length, expected.length, analysis.join('\n'));

  expected = _.invoke(expected, 'toString');
  _.each(analysis, function (result, i) {
    assert(_.contains(expected, result), analysis.join('\n'));
  });
};

describe('JzA', function () {
  describe('General JzA', function () {
    it('should create a new state', function () {
      var jza = jzaTools.jza('empty');
      var s = jza.addState('state');
      assert.equal(s.name, 'state');
      assert.equal(jza.getStatesByName('state').length, 1);
      assert.equal(jza.getStateByName('state').name, 'state');
      assert.equal(jza.getStatesByRegex(/TAT/i)[0].name, 'state');
    });

    it('should create transitions', function () {
      var jza = jzaTools.jza('empty');
      var tonic = jza.addState('tonic');
      var subdominant = jza.addState('subdominant');

      jza.addTransition('ii', tonic, subdominant);
      tonic.addTransition('IV', subdominant);

      _.each(['ii', 'IV'], function (sym, i) {
        assert(tonic.transitions[i].symbol.eq(sym));
        assert.equal(tonic.transitions[i].from.name, 'tonic');
        assert.equal(tonic.transitions[i].to.name, 'subdominant');
        assert(tonic.hasTransition(sym, subdominant));
        assert(!subdominant.hasTransition(sym, tonic));
      });
    });

    it('should not create duplicate transitions', function () {
      var jza = jzaTools.jza('empty');
      var state1 = jza.addState('state1');
      var state2 = jza.addState('state2');

      state1.addTransition('#IVx', state2);
      assert.equal(state1.transitions.length, 1);
      state1.addTransition('bVx', state2);
      assert.equal(state1.transitions.length, 1);
    });

    it('should find transitions', function () {
      var jza = jzaTools.jza('empty');
      var tonic = jza.addState('tonic');
      var subdominant = jza.addState('subdominant');
      var dominant = jza.addState('subdominant');

      jza.addTransition('vi', tonic, subdominant);
      jza.addTransition('V', subdominant, dominant);
      jza.addTransition('vi', dominant, tonic);

      assert.equal(jza.getTransitions().length, 3);
      assert.equal(jza.getTransitions()[0].from.name, 'tonic');
      assert.equal(jza.getTransitions()[0].to.name, 'subdominant');

      assert.equal(jza.getTransitionsBySymbol('vi').length, 2);
      assert.equal(jza.getTransitionsByToState(tonic)[0].symbol.toString(), 'VIm');
      assert.equal(tonic.getNextStatesBySymbol('vi')[0].name, 'subdominant');
    });

    it('should only end in an end state', function () {
      var jza = jzaTools.jza('empty');
      var initial = jza.addState('initial', false, true);
      var start = jza.addState('start', true, false);
      var end = jza.addState('end', false, true);
      var notEnd = jza.addState('not end', true, false);
      var analysis;

      jza.addTransition('I', initial, start);
      jza.addTransition('IV', start, end);
      jza.addTransition('IV', start, notEnd);

      analysis = jza.analyze(['I', 'IV']);

      assert.equal(analysis.length, 1);
      assert.equal(analysis[0][1].name, 'end');
    });

    it('should only start in a start state', function () {
      var jza = jzaTools.jza('empty');
      var initial = jza.addState('initial', false, true);
      var start = jza.addState('start', true, false);
      var notStart = jza.addState('start', false, false);
      var end = jza.addState('end', false, true);
      var analysis;

      jza.addTransition('I', initial, start);
      jza.addTransition('I', initial, notStart);
      jza.addTransition('IV', start, end);
      jza.addTransition('IV', notStart, end);

      analysis = jza.analyze(['I', 'IV']);

      assert.equal(analysis.length, 1);
      assert.equal(analysis[0][0].name, 'start');
    });

    describe('when training data', function () {
      var jza = jzaTools.jza('empty');
      var initial = jza.addState('initial', false, false);
      var start1 = jza.addState('start1', true, false);
      var start2 = jza.addState('start2', true, false);
      var middle1 = jza.addState('middle1', false, false);
      var middle2 = jza.addState('middle2', false, false);
      var end1 = jza.addState('end1', false, true);
      var end2 = jza.addState('end2', false, true);

      var i_s1_I = jza.addTransition('I', initial, start1);
      var i_s2_I = jza.addTransition('I', initial, start2);
      var s1_m1_IV = jza.addTransition('IV', start1, middle1);
      var s1_m2_V = jza.addTransition('V', start1, middle2);
      var s2_m2_V = jza.addTransition('V', start2, middle2);
      var m1_e1_V = jza.addTransition('V', middle1, end1);
      var m1_e2_I = jza.addTransition('I', middle1, end2);
      var m2_e1_I = jza.addTransition('I', middle2, end1);

      analysisShouldBeWithJza(jza, ['I', 'IV', 'V'], [
        ['start1', 'middle1', 'end1']
      ]);

      analysisShouldBeWithJza(jza, ['I', 'IV', 'I'], [
        ['start1', 'middle1', 'end2']
      ]);
      
      analysisShouldBeWithJza(jza, ['I', 'V', 'I'], [
        ['start1', 'middle2', 'end1'],
        ['start2', 'middle2', 'end1']
      ]);

      jza.trainSequences([
        ['I', 'IV', 'V'],
        ['I', 'IV', 'I'], 
        ['I', 'V', 'I']
      ]);

      it('should produce proper counts', function () {
        assert.equal(i_s1_I.count, 0); // We currently don't keep track of initial transitions
        assert.equal(i_s2_I.count, 0); // We currently don't keep track of initial transitions
        assert.equal(s1_m1_IV.count, 2);
        assert.equal(s1_m2_V.count, 0.5);
        assert.equal(s2_m2_V.count, 0.5);
        assert.equal(m1_e1_V.count, 1);
        assert.equal(m1_e2_I.count, 1);
        assert.equal(m2_e1_I.count, 1);
      });

      it('should produce proper probabilities', function () {
        assert.equal(s1_m1_IV.getProbability(), 0.8);
        assert.equal(s1_m2_V.getProbability(), 0.2);
      });

      it('should produce probabilities of different states given a symbol', function () {
        var states = jza.getStateProbabilitiesGivenSymbol('V');
        assert.equal(states.middle2, 0.5);
        assert.equal(states.end1, 0.5);

        // Currently, we don't add a count for initial transitions, which is why start1 and start2 are 0
        // Maybe change this
        states = jza.getStateProbabilitiesGivenSymbol('I');
        assert.equal(states.end1, 0.5);
        assert.equal(states.end2, 0.5);
      });

      it('should produce probabilities of different symbols given state regex', function () {
        var symbols = jza.getSymbolProbabilitiesGivenStateRegex(/middle/);
        assert.equal(symbols.IVM, 2/3);
        assert.equal(symbols.Vx, 1/3);
      });

      it('should produce probabilities of different transitions given state regex', function () {
        var symbols = jza.getTransitionProbabilitiesGivenStateRegex(/middle/);
        assert.equal(symbols['IM: end1'], 1/3);
        assert.equal(symbols['IM: end2'], 1/3);
        assert.equal(symbols['Vx: end1'], 1/3);

        symbols = jza.getTransitionProbabilitiesGivenStateRegex(/middle/, 'symbol');
        assert.equal(symbols.IM, 2/3);
        assert.equal(symbols.Vx, 1/3);

        symbols = jza.getTransitionProbabilitiesGivenStateRegex(/middle/, 'state');
        assert.equal(symbols.end1, 2/3);
        assert.equal(symbols.end2, 1/3);
      });

      it('should serialize and load data', function () {
        json = jza.serialize();
        jzaTools.load(json);

        analysisShouldBeWithJza(jza, ['I', 'IV', 'V'], [
          ['start1', 'middle1', 'end1']
        ]);

        analysisShouldBeWithJza(jza, ['I', 'IV', 'I'], [
          ['start1', 'middle1', 'end2']
        ]);
        
        analysisShouldBeWithJza(jza, ['I', 'V', 'I'], [
          ['start1', 'middle2', 'end1'],
          ['start2', 'middle2', 'end1']
        ]);

        assert.equal(jza.getTransitionsBySymbol('IV')[0].getProbability(), 0.8);
        assert.equal(jza.getTransitionsBySymbol('V')[0].getProbability(), 0.2);
      });
    });

    describe('when training data with many paths', function () {
      var jza = jzaTools.jza('empty');
      var initial = jza.addState('initial', false, false);
      var start1 = jza.addState('start1', true, false);
      var start2 = jza.addState('start2', true, false);
      var middle1 = jza.addState('middle1', false, false);
      var middle2 = jza.addState('middle2', false, false);
      var end1 = jza.addState('end1', false, true);
      var end2 = jza.addState('end2', false, true);

      var i_s1 = jza.addTransition('I', initial, start1);
      var i_s2 = jza.addTransition('I', initial, start2);
      var s1_m1 = jza.addTransition('V', start1, middle1);
      var s2_m2 = jza.addTransition('V', start2, middle2);
      var m1_e1 = jza.addTransition('I', middle1, end1);
      var m1_e2 = jza.addTransition('I', middle1, end2);
      var m2_e1 = jza.addTransition('I', middle2, end1);

      analysisShouldBeWithJza(jza, ['I', 'V', 'I'], [
        ['start1', 'middle1', 'end1'],
        ['start1', 'middle1', 'end2'],
        ['start2', 'middle2', 'end1']
      ]);

      jza.trainSequence(['I', 'V', 'I']);

      it('should produce proper counts', function () {
        assert.equal(i_s1.count, 0); // We currently don't keep track of initial transitions
        assert.equal(i_s2.count, 0); // We currently don't keep track of initial transitions
        assert.equal(s1_m1.count, 0.5);
        assert.equal(s2_m2.count, 0.5);
        assert.equal(m1_e1.count, 1/3);
        assert.equal(m1_e2.count, 1/3);
        assert.equal(m2_e1.count, 1/3);
      });
    });
  });

  describe('Default JzA', function () {
    var jza = jzaTools.jza();
    var analysisShouldBe = _.partial(analysisShouldBeWithJza, jza); // Locally scoped version of function with common jza

    it('should have primitive transitions for functional states', function () {
      var tonic = jza.getStateByName('Tonic 1');
      var subdominant = jza.getStateByName('Subdominant 2');
      var dominant = jza.getStateByName('Dominant 5');

      assert(tonic.hasTransition('ii', subdominant));
      assert(subdominant.hasTransition('ii', subdominant));
      assert(subdominant.hasTransition('V', dominant));
      assert(dominant.hasTransition('V', dominant));
      assert(dominant.hasTransition('I', tonic));
      assert(tonic.hasTransition('I', tonic));
    });

    it('should analyze a list of symbols', function () {
      analysisShouldBe(['iii', 'vi', 'ii', 'V', 'I'], [
        ['Tonic 3', 'Tonic 6', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['Dominant 3', 'Tonic 6', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['Tonic 3', 'Subdominant 6', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['Tonic 3', 'Subdominant 6', 'Unpacked Vx', 'Dominant 5', 'Tonic 1']
      ]);

      analysisShouldBe(['iii', 'vi', 'ii', 'V', '#ivø'], []);
    });

    it('should get pathways for a long list of symbols', function () {
      var sequence = ['ii', 'V', 'I'];
      var longSequence = [];

      _.times(40, function () {
        longSequence = longSequence.concat(sequence);
      });

      assert.equal(jza.getPathways(longSequence).length, 119);
    });

    it('should validate a list of symbols', function () {      
      assert(jza.validate(['iii', 'vi', 'ii', 'V', 'I']));
      assert(!jza.validate(['iii', 'vi', 'ii', 'V', '#ivø']));
    });

    it('should handle tritone substitutions', function () {
      analysisShouldBe(['iii', 'bIIIx', 'ii', 'bIIx', 'I'], [
        ['Tonic 3', 'Tonic b3', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['Dominant 3', 'Tonic b3', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['Tonic 3', 'Subdominant 6', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['Tonic 3', 'V / IIm', 'Subdominant 2', 'Dominant 5', 'Tonic 1'],
        ['ii / IIm', 'V / IIm', 'Subdominant 2', 'Dominant 5', 'Tonic 1']
      ]);

      analysisShouldBe(['iii', 'vi', 'ii', 'bIIm', 'I'], []);
    });

    it('should handle unpacked chords', function () {
      analysisShouldBe(['viim', 'IIIx', 'bviim', 'bIIIx'], [
        ['Unpacked IIIx', 'Tonic 3', 'Unpacked bIIIx', 'Tonic b3'],
        ['Unpacked IIIx', 'Tonic 3', 'Unpacked bIIIx', 'Subdominant 6'],
        ['Unpacked IIIx', 'Dominant 3', 'Unpacked bIIIx', 'Tonic b3']
      ]);

      analysisShouldBe(['ii', 'V', 'IV', 'bVIIx', 'I'], [
        ['Unpacked IIm', 'Subdominant 2', 'Subdominant 4', 'Dominant b7', 'Tonic 1']
      ]);

      analysisShouldBe(['ii', 'V'], [
        ['Subdominant 2', 'Dominant 5'],
        ['Unpacked IIm', 'Subdominant 2'],
        ['Unpacked Vx', 'Dominant 5']
      ]);
      
      analysisShouldBe(['im', 'ivm', 'viim', 'IIIx', 'bIIIM'], [
        ['Tonic 1', 'Subdominant 4', 'Unpacked IIIx', 'Dominant 3', 'Tonic b3']
      ]);
    });

    it('should handle tonicization', function () {
      analysisShouldBe(['ii', 'vm', 'Ix', 'IV'], [
        ['Subdominant 2', 'ii / IVM', 'V / IVM', 'Subdominant 4']
      ]);

      analysisShouldBe(['ii', 'viiø', 'IIIx', 'vi'], [
        ['Subdominant 2', 'ii / VIm', 'V / VIm', 'Subdominant 6']
      ]);
    });

    it('should handle applied chords', function () {
      analysisShouldBe(['I', 'VIIx', 'iii'], [
        ['Tonic 1', 'V / IIIm', 'Tonic 3'],
        ['Tonic 1', 'Subdominant 4', 'Dominant 3'] // TODO: I don't like that this is an option
      ]);

      analysisShouldBe(['IIIM', 'Vx', 'I'], [
        ['Tonic 3', 'V / IM', 'Tonic 1']
      ]);
    });

    it('should not unpack elaborated minor chords', function () {
      analysisShouldBe(['#ivø', 'VIIx', 'iii', 'VIx'], [
        ['ii / IIIm', 'V / IIIm', 'Tonic 3', 'Tonic 6'],
        ['ii / IIIm', 'V / IIIm', 'Dominant 3', 'Tonic 6'],
        ['ii / IIIm', 'V / IIIm', 'Tonic 3', 'Subdominant 6']
      ]);
    });

    it('should handle diminished chords', function () {
      analysisShouldBe(['I', '#Io', 'ii'], [
        ['Tonic 1', 'Tonic 6', 'Subdominant 2'],
        ['Tonic 1', 'Subdominant 6', 'Subdominant 2'],
        ['Tonic 1', 'V / IIm', 'Subdominant 2']
      ]);

      analysisShouldBe(['I', 'bIIIo', 'ii'], [
        ['Tonic 1', 'Diminished approaching IIm', 'Subdominant 2'],
      ]);
    });

    it('should handle neighbor chords', function () {
      analysisShouldBe(['V', 'I', 'IV', 'I', 'iii'], [
        ['Dominant 5', 'IM with neighbor', 'Neighbor of IM', 'Tonic 1', 'Tonic 3'],
        ['V / IM', 'IM with neighbor', 'Neighbor of IM', 'Tonic 1', 'Tonic 3']
      ]);

      analysisShouldBe(['IV', 'I'], []);
    });

    it('should handle diatonic passing chords', function () {
      analysisShouldBe(['I', 'ii', 'iii', 'IV'], [
        ['Tonic with passing chord', 'Passing chord', 'Tonic 3', 'Subdominant 4'],
        ['Tonic 1', 'Subdominant with passing chord', 'Passing chord', 'Subdominant 4']
      ]);

      analysisShouldBe(['iii', 'ii', 'I'], [
        ['Tonic with passing chord', 'Passing chord', 'Tonic 1']
      ]);
    });

    it('should handle sus chords', function () {
      analysisShouldBe(['Vs', 'I'], [
        ['Dominant 5', 'Tonic 1'],
        ['V / IM', 'Tonic 1']
      ]);
    });

    it('should handle chromatic approaching chords', function () {
      analysisShouldBe(['ii', 'IIIx', 'IV'], [
        ['Subdominant 2', 'Chromatic approaching IVM', 'Subdominant 4']
      ]);
    });

    it('should find a failure point iff there is one', function () {
      var failurePoint;

      failurePoint = jza.findFailurePoint(['I', 'bIIø', 'IV']);
      assert(failurePoint);
      assert.equal(failurePoint.index, 2);
      assert.equal(failurePoint.symbol.toString(), 'IVM');
      assert.equal(failurePoint.previousStates[0].name, 'Neighbor of IM');
      assert(!failurePoint.invalidEndState);

      failurePoint = jza.findFailurePoint(['I', 'bIIø']);
      assert(failurePoint);
      assert.equal(failurePoint.index, 1);
      assert.equal(failurePoint.symbol.toString(), 'bIIø');
      assert(failurePoint.invalidEndState);

      failurePoint = jza.findFailurePoint(['ii', 'V', 'I']);
      assert.equal(failurePoint, null);
    });
  });

  describe('Sequence', function () {
    var jza = jzaTools.import('sample/model.json');

    // [symbol, state, symbol, state, etc.]
    var createSequence = function (arr) {
      var firstTransition = jza.getTransitionByParams({symbol: arr[0], to: arr[1], isStart: true});
      var i, transitions, nextTransition;

      if (!firstTransition) return null;

      transitions = [firstTransition];
      for (i = 2; i < arr.length; i += 2) {
        nextTransition = _.last(transitions).to.getTransitionByParams({symbol: arr[i], to: arr[i + 1]});

        if (!nextTransition) return null;
        transitions.push(nextTransition);
      }

      return new jzaTools.Sequence(jza, transitions);
    };

    var ensureSequence = function (seq, arr) {
      var transition, fromState;

      for (i = 0; i < seq.length(); i += 1) {
        transition = seq.index(i);
        assert(transition.symbol.eq(arr[2 * i]));
        assert(_.contains(jza.getStatesByName(arr[2 * i + 1]), transition.to));
      }
    };

    it('should generate an n-length sequence given a start and end symbol', function () {
      var sequence = jza.generateNLengthSequenceWithStartAndEnd(4, 'ii', 'iii');

      assert.equal(sequence.length(), 4);
      assert.equal(sequence.index(0).symbol.toString(), 'IIm');
      assert.equal(sequence.index(3).symbol.toString(), 'IIIm');

      var startState = jza.getStateByName('Subdominant 2');
      var endState = jza.getStateByName('Tonic 3');

      sequence = jza.generateNLengthSequenceWithStartAndEnd(4, 'ii', 'iii', startState, endState);

      assert.equal(sequence.length(), 4);
      assert.equal(sequence.index(0).symbol.toString(), 'IIm');
      assert.equal(sequence.index(3).symbol.toString(), 'IIIm');
      assert.equal(sequence.index(0).to, startState);
      assert.equal(sequence.index(3).to, endState);
    });

    it('should initiate a sequence', function () {
      var seq = jza.buildSequence();
      assert.equal(seq.length(), 0);

      seq = jza.buildSequence('ii');
      assert.equal(seq.length(), 1);
      assert.equal(seq.first().symbol.toString(), 'IIm');
      assert.equal(seq.transitions.length, 1);
    });

    it('should add a chord to the sequence', function () {
      var seq = jza.buildSequence('ii').add(true);

      assert.equal(seq.length(), 2);
      assert.equal(seq.index(0).to, seq.index(1).from);

      seq = seq.add();

      assert.equal(seq.length(), 3);
      assert.equal(seq.index(1).to, seq.index(2).from);
      assert(!seq.index(1).symbol.eq(seq.index(2).symbol));

      seq = jza.buildSequence().add();
      assert.equal(seq.length(), 1);
    });

    it('should add n chords to the sequence', function () {
      var seq = jza.buildSequence('ii').addN(10);
      var i;

      assert.equal(seq.length(), 11);

      for (i = 0; i < 10; i += 1) {
        assert(!seq.index(i).symbol.eq(seq.index(i + 1).symbol));
      }
    });

    it('should keep adding chords to a sequence until an end state is reached', function () {
      var seq = jza.buildSequence();
      var IWithNeightborState = jza.getStateByName('IM with neighbor');
      var initialTransition = jza.getTransitionsByToState(IWithNeightborState)[0];
      seq.transitions = [initialTransition];

      seq = seq.addFull();
      assert.equal(seq.length(), 3);
    });

    it('should keep adding chords to a sequence until a particular transition is reached', function () {
      var seq = jza.buildSequence('I').addUntilSymbol('Vx');

      assert.equal(seq.first().symbol.toString(), 'IM');
      assert.equal(seq.last().symbol.toString(), 'Vx');
    });

    it('should remove a chord from the sequence', function () {
      var seq = jza.buildSequence('ii').add().remove();

      assert.equal(seq.length(), 1);
      assert.equal(seq.index(0).symbol.toString(), 'IIm');

      assert.equal(seq.remove().length(), 0);
    });

    it('should remove n chords from the sequence', function () {
      var seq = jza.buildSequence('ii').addN(10).removeN(5);

      assert.equal(seq.length(), 6);
    });

    it('should regenerate the last chord in the sequence', function () {
      var seq = jza.buildSequence('ii').add();
      var oldSymbol = seq.last().symbol;

      seq = seq.changeLast();

      assert.equal(seq.length(), 2);
      assert(!seq.index(1).symbol.eq(seq.first().symbol));
      assert(!seq.index(1).symbol.eq(oldSymbol));
    });

    describe('#splice', function () {
      it('should splice the sequence at the beginning', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']).splice(0);
        ensureSequence(seq, ['ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']);
      });

      it('should splice the sequence at the end', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']).splice(3);
        ensureSequence(seq, ['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx']);
      });

      it('should splice the sequence at the middle if possible', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']).splice(2);
        ensureSequence(seq, ['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'Vx', 'Dominant 5']);
      });

      it('should not splice the sequence at the middle if not possible', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']).splice(1);
        ensureSequence(seq, ['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']);
      });
    });

    describe('#makeUnique', function () {
      it('should leave a unique sequence untouched', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'IIx', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']).makeUnique();
        ensureSequence(seq, ['VIx', 'Tonic 6', 'IIx', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']);
      });

      it('should perform a splice when the first transition can be spliced', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'I', 'Tonic 1', 'I', 'Tonic 1', 'IV', 'Subdominant 4']).makeUnique();
        ensureSequence(seq, ['VIx', 'Tonic 6', 'I', 'Tonic 1', 'IV', 'Subdominant 4']);
      });

      it('should perform a splice when the second transition can be spliced', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'ii', 'Unpacked Vx', 'Vx', 'Dominant 5']).makeUnique();
        ensureSequence(seq, ['VIx', 'Tonic 6', 'ii', 'Subdominant 2', 'Vx', 'Dominant 5']);
      });

      it('should splice multiple duplicates', function () {
        var seq = createSequence(['VIx', 'Tonic 6', 'I', 'Tonic 1', 'I', 'Tonic 1', 'I', 'Tonic 1', 'IV', 'Subdominant 4']).makeUnique();
        ensureSequence(seq, ['VIx', 'Tonic 6', 'I', 'Tonic 1', 'IV', 'Subdominant 4']);
      });

      it('should splice from the beginning', function () {
        var seq = createSequence(['I', 'Tonic 1', 'I', 'Tonic 1', 'IV', 'Subdominant 4']).makeUnique();
        ensureSequence(seq, ['I', 'Tonic 1', 'IV', 'Subdominant 4']);
      });

      it('should splice from the end', function () {
        var seq = createSequence(['I', 'Tonic 1', 'IV', 'Subdominant 4', 'IV', 'Subdominant 4']).makeUnique();
        ensureSequence(seq, ['I', 'Tonic 1', 'IV', 'Subdominant 4']);
      });
    });

    // Use 0 probability transitions at reharmonization points to ensure that the reharmonization is different
    describe('#reharmonizeAtIndex', function () {
      it('should reharmonize a phrase from the beginning', function () {
        var seq = createSequence(['iii', 'ii / IIm', 'VIx', 'V / IIm', 'ii', 'Subdominant 2', 'VIM', 'Subdominant 6']).reharmonizeAtIndex(2);
        assert(seq.last().symbol.eq('VIM'));
        assert(!seq.index(seq.length() - 2).symbol.eq('ii'));
      });

      it('should reharmonize a phrase from the end', function () {
        var seq = createSequence(['I', 'Tonic 1', 'bVIx', 'Subdominant b6', 'bVIIs', 'ii / IIm', 'VIx', 'V / IIm', 'ii', 'Subdominant 2']).reharmonizeAtIndex(2);
        assert(seq.index(0).symbol.eq('I'));
        assert(seq.index(1).symbol.eq('bVIx'));
        assert(!seq.index(2).symbol.eq('bVIIs'));
      });

      it('should reharmonize a phrase in the middle', function () {
        var seq = createSequence(['I', 'Tonic 1', 'bVIx', 'Subdominant b6', 'iii', 'Unpacked VIx', 'VIx', 'Subdominant 6', 'IIx', 'Subdominant 2']).reharmonizeAtIndex(2);
        assert(seq.index(0).symbol.eq('I'));
        assert(seq.index(1).symbol.eq('bVIx'));
        assert(!seq.index(2).symbol.eq('iii'));
        assert(seq.last().symbol.eq('IIx'));
      });
    });
  });
});