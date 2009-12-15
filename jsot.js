var Version = Class.create({
  initialize: function() {
    this.myVersion = 0;
    this.yourVersion = 0;
  },
  myNext: function() {
    this.myVersion += 1;
  },
  yourNext: function() {
    this.yourVersion += 1;
  },
  clone: function() {
    var ver = new Version();
    ver.myVersion = this.myVersion;
    ver.yourVersion = this.yourVersion;
    return ver;
  },
  reverseClone: function() {
    var ver = new Version();
    ver.myVersion = this.yourVersion;
    ver.yourVersion = this.myVersion;
    return ver;
  },
  toString: function() {
    return "[" + this.myVersion + ", " + this.yourVersion + "]";
  }
});

var VersionedOperation = Class.create({
  initialize: function(version, operation) {
    this.version = version;
    this.operation = operation;
  },
  apply: function(doc) {
    this.operation.apply(doc);
  },
  clone: function() {
    return new VersionedOperation(this.version.clone(), this.operation.clone());
  },
  toString: function() {
    //return this.version.toString() + this.operation.toString();
    return this.operation.toString();
  }
});

var Document = Class.create({
  initialize: function(eid, contents) {
    this.elm = $(eid);
    this.elm.obj = this;
    this.version = new Version();
    this.contents = contents;
    this.ops = $A();
    this.receivedOps = $A();
    this.appliedOps = $A();
    this.unsubmittedOps = $A();
    this.submittedOps = $A();
  },
  connect: function(opponent) {
    this.opponent = opponent;
  },
  addOp: function(op) {
    this.ops.push(new VersionedOperation(this.version.clone(), op));
  },
  receiveOp: function(op, version) {
    this.receivedOps.push(new VersionedOperation(version.reverseClone(), op));
  },
  applyAll: function() {
    for (var i = 0; i < this.ops.length; i++) {
      this.ops[i].apply(this);
      this.appliedOps.push(this.ops[i].clone());
      this.unsubmittedOps.push(this.ops[i].clone());
      this.version.myNext();
    }
    this.ops = $A();
    for (var i = 0; i < this.receivedOps.length; i++) {
      this.receivedOps[i].apply(this);
      //this.appliedOps.push(this.receivedOps[i].clone());
      this.submittedOps.push(this.receivedOps[i].clone());
      this.version.yourNext();
    }
    this.receivedOps = $A();
  },
  sync: function() {
    var unsubmittedOps = $A();
    for (var i = 0; i < this.unsubmittedOps.length; i++) {
      unsubmittedOps.push(this.unsubmittedOps[i].clone());
    }
    this.opponent.submit(this.version.clone(), unsubmittedOps);
    this.unsubmittedOps = $A();
  },
  submit: function(version, submittedOps) {
    var diff = this.version.myVersion - version.yourVersion;
    for (var i = this.appliedOps.length - diff; i < this.appliedOps.length; i++) {
      for (var j = 0; j < submittedOps.length; j++) {
        //submittedOps[j].transformWith(this.appliedOps[i]);
        submittedOps[j].operation.transformWith(this.appliedOps[i].operation);
      }
    }
    for (var i = 0; i < submittedOps.length; i++) {
      submittedOps[i].apply(this);
      this.submittedOps.push(submittedOps[i].clone());
      this.version.yourNext();
    }
    this.show();
  },
  show: function() {
    this.elm.value = this.contents;
  },
  inspect: function() {
    //var val = this.contents + '<br />' + this.version.toString() + '<br />';
    var val = this.version.toString() + '<br />';

    val += '<div style="float:left; margin-right:10px;">';
    for (var i = 0; i < this.appliedOps.length; i++) {
      val += this.appliedOps[i].toString() + '<br />';
    }
    val += '</div>';

    val += '<div style="float:left;">';
    for (var i = 0; i < this.submittedOps.length; i++) {
      val += this.submittedOps[i].toString() + '<br />';
    }
    val += '</div><br style="clear:both" />';

    if (this.logElm) {
      this.logElm.innerHTML = val;
    }
    if (this.contentsElm) {
      this.contentsElm.innerHTML = this.contents;
    }
    return val;
  }
});

function toSAA(aa) {
  var ret = '';
  for (var i = aa.length - 1; 0 <= i; i--) {
    for (var j = 0; j < aa[0].length; j++) {
      if (aa[i][j]) {
        ret += aa[i][j][1] ? '*' : '-';
        ret += '/';
        ret += aa[i][j][0] ? '*' : '-';
        ret += '|';
      }
      else {
        ret += '-/-|';
      }
    }
    ret += "\n";
  }
  return ret;
}

var Operation = Class.create({
});
Operation.transform = function(doc1, doc2) {
  var transformations = [[]];
  for (var i1 = 0; i1 < doc1.unsubmittedOps.length; i1++) {
    transformations[0].push([doc1.unsubmittedOps[i1].operation, null]);
  }
  transformations[0].push([null, null]);
  for (var i2 = 0; i2 < doc2.unsubmittedOps.length; i2++) {
    if (!transformations[i2]) {
      transformations[i2] = [];
    }
    if (transformations[i2][0]) {
      transformations[i2][0][1] = doc2.unsubmittedOps[i2].operation;
    }
    else {
      transformations[i2][0] = [null, doc2.unsubmittedOps[i2].operation];
    }
  }
  transformations.push([null, null]);

  for (var i1 = 0; i1 < transformations.length - 1; i1++) {
    for (var i2 = 0; i2 < transformations[0].length - 1; i2++) {
      var ops = transformations[i1][i2];
      var op1 = ops[0];
      var op2 = ops[1];
      var op1t = op1.clone();
      var op2t = op2.clone();
      if (op1 instanceof DeletionOp) {
        if (op2 instanceof DeletionOp) {
          if (op1.startPosition < op2.startPosition) {
            op2t.startPosition -= 1;
            op2t.endPosition -= 1;
          }
          else if (op2.startPosition < op1.startPosition) {
            op1t.startPosition -= 1;
            op1t.endPosition -= 1;
          }
          else {
            op1t = new NoOp();
            op2t = new NoOp();
          }
        }
        else if (op2 instanceof InsertionOp) {
          if (op1.startPosition < op2.position) {
            op2t.position -= 1;
          }
          else if (op2.position < op1.startPosition) {
            op1t.startPosition += 1;
            op1t.endPosition += 1;
          }
          else {
            // TODO: consider
            op1t.startPosition += 1;
            op1t.endPosition += 1;
          }
        }
        else if (op2 instanceof NoOp) {
        }
        else {
          throw 'Invalid operation: ' + op2;
        }
      }
      else if (op1 instanceof InsertionOp) {
        if (op2 instanceof DeletionOp) {
          if (op1.position < op2.startPosition) {
            op2t.startPosition += 1;
            op2t.endPosition += 1;
          }
          else if (op2.startPosition < op1.position) {
            op1t.position -= 1;
          }
          else {
            // TODO: consider
            op2t.startPosition += 1;
            op2t.endPosition += 1;
          }
        }
        else if (op2 instanceof InsertionOp) {
          if (op1.position < op2.position) {
            op2t.position += 1;
          }
          else if (op2.startPosition < op1.startPosition) {
            op1t.position += 1;
          }
          else {
            // TODO: consider
            op1t.position += 1;
          }
        }
        else if (op2 instanceof NoOp) {
        }
        else {
          throw 'Invalid operation: ' + op2;
        }
      }
      else if (op1 instanceof NoOp) {
      }
      else {
        throw 'Invalid operation: ' + op1;
      }
      if (!transformations[i1][i2+1]) transformations[i1][i2+1] = [null, null];
      if (!transformations[i1+1][i2]) transformations[i1+1][i2] = [null, null];
      transformations[i1][i2+1][1] = op2t;
      transformations[i1+1][i2][0] = op1t;
    }
  }
  //alert(toSAA(transformations));
  for (var j1 = 0; j1 < transformations.length - 1; j1++) {
    var last = transformations[j1].length - 1;
    //doc1.addOp(transformations[j1][last][1]);
    doc1.receiveOp(transformations[j1][last][1], doc2.version);
  }
  for (var j2 = 0; j2 < transformations[0].length - 1; j2++) {
    var last = transformations.length - 1;
    //doc2.addOp(transformations[last][j2][0]);
    doc2.receiveOp(transformations[last][j2][0], doc1.version);
  }
  doc1.applyAll();
  doc2.applyAll();
  doc1.unsubmittedOps = [];
  doc2.unsubmittedOps = [];
  doc1.show();
  doc2.show();
};

var InsertionOp = Class.create(Operation, {
  initialize: function($super, value, position) {
    $super();
    this.value = value;
    this.position = position;
  },
  apply: function(doc) {
    doc.contents = doc.contents.substring(0, this.position) + 
      this.value + doc.contents.substring(this.position, doc.contents.length);
  },
  transformWith: function(op) {
    if (op instanceof DeletionOp) {
      if (op.startPosition < this.position) {
        this.position -= 1;
      }
    }
    else if (op instanceof InsertionOp) {
      if (op.position < this.position) {
        this.position += 1;
      }
    }
    else {
      throw 'Invalid op: ' + op;
    }
  },
  clone: function() {
    return new InsertionOp(this.value, this.position);
  },
  toString: function() {
    return "Ins " + this.value + " " + this.position;
  }
});

var DeletionOp = Class.create(Operation, {
  initialize: function($super, startPosition, endPosition) {
    $super();
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    if (this.startPosition == this.endPosition) {
      this.startPosition -= 1;
    }
  },
  apply: function(doc) {
    doc.contents = doc.contents.substring(0, this.startPosition) + 
      doc.contents.substring(this.endPosition, doc.contents.length);
  },
  transformWith: function(op) {
    if (op instanceof DeletionOp) {
      if (op.startPosition < this.startPosition) {
        this.startPosition -= 1;
        this.endPosition -= 1;
      }
    }
    else if (op instanceof InsertionOp) {
      if (op.position < this.startPosition) {
        this.startPosition += 1;
        this.endPosition += 1;
      }
    }
    else {
      throw 'Invalid op: ' + op;
    }
  },
  clone: function() {
    return new DeletionOp(this.startPosition, this.endPosition);
  },
  toString: function() {
    return "Del " + this.startPosition;
  }
});

var NoOp = Class.create(Operation, {
  initialize: function($super) {
    $super();
  },
  apply: function(doc) {},
  clone: function() {
    return new NoOp();
  },
  toString: function() {
    return 'Noop';
  }
});

var ignoredCodes = [37, 38, 39, 40, 16, 17]; // arrows x 4, shift, ctrl
var deleteCode = 8;
var doc1;
var doc2;

function init() {
  doc1 = new Document('doc1', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  doc1.logElm = $('log1');
  doc1.contentsElm = $('contents1');
  doc2 = new Document('doc2', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  doc2.logElm = $('log2');
  doc2.contentsElm = $('contents2');
  doc1.connect(doc2);
  doc2.connect(doc1);
  doc1.show();
  doc2.show();
  doc1.inspect();
  doc2.inspect();
}

function applyPersonalOperation(elm, event) {
  var doc = elm.obj;
  var keyCode = event.keyCode;
  if (ignoredCodes.include(keyCode)) return;
  var start = elm.selectionStart;
  var end = elm.selectionEnd;

  if (deleteCode == keyCode) {
    var dop = new DeletionOp(start, end);
    doc.addOp(dop);
    doc.applyAll();
  }
  else {
    if (start != end) {
      var dop = new DeletionOp(start, end);
      doc.addOp(dop);
    }
    var c = String.fromCharCode(keyCode);
    var iop = new InsertionOp(c, start);
    doc.addOp(iop);
    doc.applyAll();
  }
  doc.inspect();
}

function submit() {
  Operation.transform(doc1, doc2);
  doc1.applyAll();
  doc2.applyAll();

  doc1.inspect();
  doc2.inspect();
}

