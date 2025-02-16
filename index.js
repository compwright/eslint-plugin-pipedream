function isModuleExports(node) {
  if (!node) return false;
  if (!node?.object || !node?.property) return false;
  if (node.object.name !== "module" || node.property.name !== "exports") return false;
  return true;
}

function isObjectWithProperties(node) {
  if (!node) return false;
  const {
    properties,
    type,
  } = node;
  if (type !== "ObjectExpression") return false;
  if (!properties || Object.keys(properties).length === 0) return false;
  return true;
}

// Objects can contain key names surrounded by quotes, or not
// propertyArray is the array of Property nodes in the component object
function astIncludesProperty(name, propertyArray) {
  // value for Literals (quotes), name for Identifiers (no quotes)
  const propertyNames = propertyArray.map((p) => p?.key?.value ?? p?.key?.name);
  return propertyNames.includes(name) || propertyNames.includes(`"${name}"`);
}

// Returns the Property node matching the given name
// propertyArray is the array of Property nodes in the component object
function findPropertyWithName(name, propertyArray) {
  return propertyArray.find((p) => {
    return p?.key?.name === name ||
      p?.key?.name === `"${name}"` ||
      p?.key?.value === name ||
      p?.key?.value === `"${name}"`;
  });
}

// Does a component contain the right property? e.g. key, version
function componentContainsPropertyCheck(context, node, propertyName, message) {
  const {
    left,
    right,
  } = node.expression;
  if (!isModuleExports(left)) return;
  if (!isObjectWithProperties(right)) return;

  if (!astIncludesProperty(propertyName, right.properties)) {
    context.report({
      node: node,
      message: message ?? `Components must export a ${propertyName} property. See https://pipedream.com/docs/components/guidelines/#required-metadata`,
    });
  }
}

// Extract props or propDefintions from the object properties of the module
function getProps(moduleProperties) {
  return moduleProperties.find((p) => {
    return p?.key?.name === "props" ||
      p?.key?.value === "props" ||
      p?.key?.name === "propDefinitions" ||
      p?.key?.value === "propDefinitions";
  });
}

// Do component props contain the right properties? e.g. label, description
function componentPropsContainsPropertyCheck(context, node, propertyName) {
  const {
    left,
    right,
  } = node.expression;
  if (!isModuleExports(left)) return;
  if (!isObjectWithProperties(right)) return;

  const { properties } = right;
  if (!(astIncludesProperty("props", properties) || astIncludesProperty("propDefinitions", properties))) return;
  const props = getProps(properties);
  if (!isObjectWithProperties(props?.value)) return;
  for (const prop of props.value?.properties) {
    const {
      key,
      value: propDef,
    } = prop;

    // We don't want to lint app props or props that are defined in propDefinitions
    if (!isObjectWithProperties(propDef)) continue;
    if (astIncludesProperty("propDefinition", propDef.properties)) continue;
    if (!astIncludesProperty(propertyName, propDef.properties)) {
      context.report({
        node: prop,
        message: `Component prop ${key?.name ?? key?.value} must have a ${propertyName}. See https://pipedream.com/docs/components/guidelines/#props`,
      });
    }
  }
}

function optionalComponentPropsHaveDefaultProperty(context, node) {
  const {
    left,
    right,
  } = node.expression;
  if (!isModuleExports(left)) return;
  if (!isObjectWithProperties(right)) return;

  const { properties } = right;
  if (!(astIncludesProperty("props", properties) || astIncludesProperty("propDefinitions", properties))) return;
  const props = getProps(properties);
  if (!isObjectWithProperties(props?.value)) return;
  for (const prop of props.value?.properties) {
    const {
      key,
      value: propDef,
    } = prop;

    // We don't want to lint app props or props that are defined in propDefinitions
    if (!isObjectWithProperties(propDef)) continue;
    if (!isObjectWithProperties(right)) continue;
    if (astIncludesProperty("propDefinition", right.properties)) continue;

    // value for Literals (quotes), name for Identifiers (no quotes)
    const optionalProp = findPropertyWithName("optional", propDef.properties);
    const optionalValue = optionalProp?.value?.value;

    if (astIncludesProperty("optional", propDef.properties) && optionalValue && !astIncludesProperty("default", propDef.properties)) {
      context.report({
        node: prop,
        message: `Component prop ${key?.name ?? key?.value} is marked "optional", so it may need a "default" property. See https://pipedream.com/docs/components/guidelines/#default-values`,
      });
    }
  }
}

// Checks to confirm the component is a source, and returns
// the node with the name specified by the user
function checkComponentIsSourceAndReturnTargetProp(node, propertyName) {
  const {
    left,
    right,
  } = node.expression;

  if (!isModuleExports(left)) return;
  if (!isObjectWithProperties(right)) return;

  const typeProp = findPropertyWithName("type", right.properties);
  // A separate rule checks the presence of the type property
  if (!typeProp) return;
  if (typeProp?.value?.value !== "source") return;

  return findPropertyWithName(propertyName, right.properties);
}

function componentSourceNameCheck(context, node) {
  const nameProp = checkComponentIsSourceAndReturnTargetProp(node, "name");
  if (!nameProp) return;
  if (!nameProp?.value?.value.startsWith("New ")) {
    context.report({
      node: nameProp,
      message: "Source names should start with \"New\". See https://pipedream.com/docs/components/guidelines/#source-name",
    });
  }
}

function componentSourceDescriptionCheck(context, node) {
  const nameProp = checkComponentIsSourceAndReturnTargetProp(node, "description");
  if (!nameProp) return;
  if (!nameProp?.value?.value.startsWith("Emit new ")) {
    context.report({
      node: nameProp,
      message: "Source descriptions should start with \"Emit new\". See https://pipedream.com/docs/components/guidelines/#source-description",
    });
  }
}

module.exports = {
  rules: {
    "required-properties-key": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentContainsPropertyCheck(context, node, "key");
          },
        };
      },
    },
    "required-properties-name": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentContainsPropertyCheck(context, node, "name");
          },
        };
      },
    },
    "required-properties-version": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentContainsPropertyCheck(context, node, "version");
          },
        };
      },
    },
    "required-properties-description": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentContainsPropertyCheck(context, node, "description");
          },
        };
      },
    },
    "required-properties-type": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentContainsPropertyCheck(context, node, "type", "Components must export a type property (\"source\" or \"action\")");
          },
        };
      },
    },
    "props-label": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentPropsContainsPropertyCheck(context, node, "label");
          },
        };
      },
    },
    "props-description": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentPropsContainsPropertyCheck(context, node, "description");
          },
        };
      },
    },
    "default-value-required-for-optional-props": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            optionalComponentPropsHaveDefaultProperty(context, node);
          },
        };
      },
    },
    "source-name": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentSourceNameCheck(context, node);
          },
        };
      },
    },
    "source-description": {
      create: function (context) {
        return {
          ExpressionStatement(node) {
            componentSourceDescriptionCheck(context, node);
          },
        };
      },
    },
  },
};
